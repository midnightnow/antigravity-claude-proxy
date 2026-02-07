package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/google/uuid"
)

// Config represents runtime configuration
type Config struct {
	Port          string
	AllowedModels []string
	ProxyURL      string
	LogDir        string
}

// Session represents a running Claude Code instance
type Session struct {
	ID        string    `json:"id"`
	CWD       string    `json:"cwd"`
	Model     string    `json:"model"`
	Status    string    `json:"status"` // "active", "idle", "dead"
	StartedAt time.Time `json:"started_at"`
	LastSeen  time.Time `json:"last_seen"`
	PID       int       `json:"pid"`
	LogPath   string    `json:"log_path"`

	pty     *os.File
	cmd     *exec.Cmd
	logFile *os.File
}

// Manifold manages all active sessions
type Manifold struct {
	sessions map[string]*Session
	config   *Config
	mu       sync.RWMutex
}

func NewManifold(config *Config) *Manifold {
	return &Manifold{
		sessions: make(map[string]*Session),
		config:   config,
	}
}

// SpawnSession creates a new Claude Code session
func (m *Manifold) SpawnSession(cwd, model string) (*Session, error) {
	sessionID := uuid.New().String()[:8]
	logPath := filepath.Join(m.config.LogDir, fmt.Sprintf("claude-bull-%s.log", sessionID))

	// specific log handling
	logFile, err := os.Create(logPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create log: %w", err)
	}

	// Prepare Claude Code command
	// We use "claude" assuming it's in PATH, or fall back to known locs
	claudeBin := "claude"
	if _, err := exec.LookPath(claudeBin); err != nil {
		// Fallback for global npm install
		claudeBin = "claude" 
	}

	cmd := exec.Command(claudeBin)
	cmd.Dir = cwd
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("ANTHROPIC_BASE_URL=%s", m.config.ProxyURL),
		"ANTHROPIC_API_KEY=dummy",
		fmt.Sprintf("ANTHROPIC_MODEL=%s", model),
	)

	// Start with PTY
	ptmx, err := pty.Start(cmd)
	if err != nil {
		logFile.Close()
		return nil, fmt.Errorf("failed to start pty: %w", err)
	}

	session := &Session{
		ID:        sessionID,
		CWD:       cwd,
		Model:     model,
		Status:    "active",
		StartedAt: time.Now(),
		LastSeen:  time.Now(),
		PID:       cmd.Process.Pid,
		LogPath:   logPath,
		pty:       ptmx,
		cmd:       cmd,
		logFile:   logFile,
	}

	// Stream output to log (and theoretically to a websocket later)
	go func() {
		io.Copy(io.MultiWriter(logFile, os.Stdout), ptmx)
		session.Status = "dead"
	}()

	// Monitor process
	go func() {
		cmd.Wait()
		// Process is done
		session.Status = "dead"
		logFile.Close()
		log.Printf("[Session %s] Process exited", sessionID)
	}()

	m.mu.Lock()
	m.sessions[sessionID] = session
	m.mu.Unlock()

	log.Printf("[Session %s] Spawned in %s with model %s (PID: %d)", sessionID, cwd, model, session.PID)
	return session, nil
}

// ListSessions returns all active/tracked sessions
func (m *Manifold) ListSessions() []*Session {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sessions := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		sessions = append(sessions, s)
	}
	return sessions
}

// KillSession terminates a session
func (m *Manifold) KillSession(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, exists := m.sessions[id]
	if !exists {
		return fmt.Errorf("session not found")
	}

	if session.cmd.Process != nil {
		session.cmd.Process.Kill()
	}
	session.pty.Close()
	session.logFile.Close()

	delete(m.sessions, id)
	log.Printf("[Session %s] Killed", id)
	return nil
}

// AttachSession returns the log path for attaching (simplest Attach MVP)
func (m *Manifold) AttachSession(id string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, exists := m.sessions[id]
	if !exists {
		return "", fmt.Errorf("session not found")
	}
	return session.LogPath, nil
}


// --- HTTP Handlers ---

func (m *Manifold) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

func (m *Manifold) handleListSessions(w http.ResponseWriter, r *http.Request) {
	sessions := m.ListSessions()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sessions": sessions,
		"count":    len(sessions),
	})
}

func (m *Manifold) handleSpawnSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CWD   string `json:"cwd"`
		Model string `json:"model"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.CWD == "" {
		req.CWD, _ = os.Getwd()
	}
	// Default model logic could be fancier
	if req.Model == "" {
		req.Model = "claude-3-5-sonnet-20241022" 
	}

	session, err := m.SpawnSession(req.CWD, req.Model)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}

func (m *Manifold) handleKillSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed (Use DELETE or POST)", http.StatusMethodNotAllowed)
		return
	}
	
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "missing session id", http.StatusBadRequest)
		return
	}

	if err := m.KillSession(id); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("Session %s killed", id)))
}

func main() {
	// Configuration from Environment
	port := os.Getenv("BULLRIDER_PORT")
	if port == "" {
		port = "9000"
	}

	proxyURL := os.Getenv("BULLRIDER_PROXY_URL")
	if proxyURL == "" {
		proxyURL = "http://localhost:8080"
	}

	logDir := os.Getenv("BULLRIDER_LOG_DIR")
	if logDir == "" {
		logDir = "/tmp"
	}

	config := &Config{
		Port:     port,
		ProxyURL: proxyURL,
		LogDir:   logDir,
	}

	manifold := NewManifold(config)

	// Register Routes
	http.HandleFunc("/health", manifold.handleHealth)
	http.HandleFunc("/api/sessions", manifold.handleListSessions)
	http.HandleFunc("/api/sessions/spawn", manifold.handleSpawnSession)
	http.HandleFunc("/api/sessions/kill", manifold.handleKillSession)
	// http.HandleFunc("/api/sessions/attach", manifold.handleAttachSession) // Reserved for Phase 2

	// Start Server
	fmt.Println("╔═══════════════════════════════════════════════╗")
	fmt.Printf("║        CLAUDE BULLRIDER v1.1                 ║\n")
	fmt.Println("╠═══════════════════════════════════════════════╣")
	fmt.Printf("║  Manifold Server: http://localhost:%s       ║\n", port)
	fmt.Printf("║  Proxy Target:    %s       ║\n", proxyURL)
	fmt.Printf("║  Logs Directory:  %s                      ║\n", logDir)
	fmt.Println("╚═══════════════════════════════════════════════╝")

	log.Fatal(http.ListenAndServe(":"+port, nil))
}
