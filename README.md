# simple-permission-risk

Checks GitHub Actions workflow files for overly broad `permissions` settings and reports them on the pull request. Runs on the GitHub runner and reads workflow YAML locally.

## What it checks

- `permissions: write-all`
- `permissions: read-all`
- missing `permissions:` block
- broad write combos (`contents` + `pull-requests` + `id-token`)

## Usage

```yaml
name: Permission risk
on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  simple-permission-risk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dmytropaduchak/simple-permission-risk@v0.1.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `github-token` | `${{ github.token }}` | Post sticky PR comments |
| `fail-on` | `none` | `none` / `medium` / `high` |
| `workflow-path` | `.github/workflows` | Workflow directory |

## Develop

```bash
npm install && npm run build
```
