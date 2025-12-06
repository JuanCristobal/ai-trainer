## GHCR Private Image Pulls from Railway

### 1) Create a GitHub Personal Access Token (Classic)
1. GitHub: Settings → Developer settings → Personal access tokens (Classic).
2. Generate new token with scopes: `write:packages`, `read:packages`, `delete:packages`.
3. Copy the token (shown once).

### 2) Configure Railway Worker Service
Add these variables to the Worker service:
- `DOCKER_USERNAME` = your GitHub username
- `DOCKER_PASSWORD` = the PAT from step 1

Set the Worker source image to:  
`ghcr.io/<github-username>/video2md-worker:latest`

Notes:
- GHCR is private; Railway will authenticate with the credentials above.
- If your GitHub username has uppercase letters, GHCR expects lowercase in the image URL.
