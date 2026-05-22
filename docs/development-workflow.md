# Development Workflow

Use this flow for normal changes. Do not push large changes directly to `master`.

## 1. Start From Master

```bash
git checkout master
git pull origin master
git checkout -b feature/short-description
```

Use `fix/short-description` for bug fixes and `chore/short-description` for maintenance.

## 2. Make Changes Locally

Before committing, inspect what changed:

```bash
git status
git diff
```

Do not commit local debug output, generated reports, `.env`, database dumps, or build artifacts.

## 3. Ask For Local Review

Ask Codex:

```text
Review my uncommitted changes before I commit
```

Fix review findings before committing.

## 4. Run Checks

Frontend:

```bash
npx tsc --noEmit
npm run lint
```

Backend:

```bash
cd backend
uv run pytest
cd ..
```

If a backend schema or migration changed, also verify migrations locally or in Docker.

## 5. Commit And Push The Branch

```bash
git add <files>
git commit -m "Short imperative summary"
git push -u origin feature/short-description
```

## 6. Open A Pull Request

Open a PR from your feature branch into `master`.

The PR should pass:

- `backend-ci`
- `expo-ci`

Ask Codex:

```text
Review this PR before merge
```

## 7. Merge And Deploy

After review and CI pass, merge the PR into `master`.

Deploy backend from the droplet:

```bash
cd /root/bookyourlife/backend
git pull origin master
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8000/healthz
```

If the public app uses the droplet API, also verify:

```bash
curl http://167.99.67.153:8000/healthz
```

## GitHub Branch Protection

Configure this manually in GitHub:

1. Repository Settings
2. Branches
3. Add branch protection rule
4. Branch name pattern: `master`
5. Enable `Require a pull request before merging`
6. Enable `Require status checks to pass before merging`
7. Select `backend-ci` and `expo-ci`
8. Enable `Require branches to be up to date before merging`
9. Save changes
