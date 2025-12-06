
# opendevbot-twitch

[![CI](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/<owner>/<repo>/actions/workflows/ci.yml)

Lightweight Twitch integration helpers (OAuth + EventSub scaffolding) used for development and testing.

Note: replace `<owner>/<repo>` in the badge URL above with your repository owner and name to enable the Actions badge.

## Quickstart

- Install dependencies:

```pwsh
# opendevbot-twitch

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![CI](https://github.com/skullgaminghq/<repo>/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/skullgaminghq/<repo>/actions/workflows/ci.yml)

Lightweight Twitch integration helpers (OAuth + EventSub scaffolding) used for development and testing.

> Note: replace `<owner>/<repo>` in the badge URLs below with your repository owner and name to enable the Actions badge and shields.

## Quickstart

- Install dependencies:

```pwsh
npm install
```

- Run tests:

```pwsh
npx vitest
```

- Run tests with coverage:

```pwsh
npm run test:coverage
```

- Start development server (auto-reloads):

```pwsh
npm run dev
```

## CI

This repository includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs tests using a MongoDB service container (`mongo:6.0`). The workflow sets `MONGO_URI` to `mongodb://localhost:27017/opendevbot_test` so no additional CI configuration is required.

## Notes

- A `.gitattributes` file with `eol=lf` is included to enforce LF line endings across platforms.
- Sensitive values (Twitch client ID/secret, production Mongo URIs) should be provided via GitHub Secrets or environment variables and not committed to the repository.

---

<!-- Badge reference links - replace OWNER/REPO with your GitHub repository -->
[contributors-shield]: https://img.shields.io/github/contributors/OWNER/REPO.svg?style=for-the-badge
[contributors-url]: https://github.com/OWNER/REPO/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/OWNER/REPO.svg?style=for-the-badge
[forks-url]: https://github.com/OWNER/REPO/network/members
[stars-shield]: https://img.shields.io/github/stars/OWNER/REPO.svg?style=for-the-badge
[stars-url]: https://github.com/OWNER/REPO/stargazers
[issues-shield]: https://img.shields.io/github/issues/OWNER/REPO.svg?style=for-the-badge
[issues-url]: https://github.com/OWNER/REPO/issues
[license-shield]: https://img.shields.io/github/license/OWNER/REPO.svg?style=for-the-badge
[license-url]: https://github.com/OWNER/REPO/blob/main/LICENSE