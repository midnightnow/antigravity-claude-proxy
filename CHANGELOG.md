# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-02-06

### Added
- Modular route-based architecture (`src/routes/`) for better maintainability
- Support for tool usage in OpenAI transcoder for local agents
- Gateway routing for `local-*` and `gemma-*` model prefixes
- Comprehensive cross-model testing (Claude ↔ Gemini switching)
- Terminal launcher with platform-specific support
- Enhanced `.gitignore` for development artifacts

### Changed
- **BREAKING**: Removed direct Gemini transcoding (now handled by Cloud Code client)
- **BREAKING**: Gateway only routes `local-*` and `gemma-*` prefixes to external agents
- Updated Antigravity version to 1.23.0 to bypass Google API version blocks
- Refactored monolithic `server.js` into modular route handlers
- Standardized project naming to "Antigravity Claude Proxy"
- Updated repository URLs to `midnightnow/antigravity-claude-proxy`
- Improved User-Agent and API client headers for compatibility

### Removed
- Deprecated `src/cli-launcher.js` (replaced by `src/launcher.js`)
- Redundant `src/transcoders/gemini.js` (functionality moved to Cloud Code client)

### Fixed
- "Unsupported version" errors from Google API
- Tool definitions not being passed to local OpenAI-compatible models
- Tool calls not being parsed in streaming responses
- Cross-model conversation handling (thinking signatures preserved correctly)

## [1.2.0] - 2026-01-10

### Added
- Multi-account OAuth support
- Proactive token refresh mechanism
- Session management and tracking
- WebSocket-based real-time dashboard updates

### Changed
- Improved error handling and user-friendly messages
- Enhanced rate limit detection and cooldown logic

## [1.1.0] - 2025-12-15

### Added
- Initial release with Antigravity integration
- Basic local agent support (LM Studio/Ollama)
- Anthropic to OpenAI transcoding
- Web UI dashboard

[1.3.0]: https://github.com/midnightnow/antigravity-claude-proxy/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/midnightnow/antigravity-claude-proxy/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/midnightnow/antigravity-claude-proxy/releases/tag/v1.1.0
