
# opendevbot-twitch

### A Twitch bot and EventSub manager for multi-channel hosting done from scratch.

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![CI](https://github.com/skullgaming31/opendevbot-Twitch/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/skullgaming31/opendevbot-Twitch/actions/workflows/ci.yml)

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
[contributors-shield]: https://img.shields.io/github/contributors/skullgaming31/opendevbot-Twitch.svg?style=for-the-badge
[contributors-url]: https://github.com/skullgaming31/opendevbot-Twitch/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/skullgaming31/opendevbot-Twitch.svg?style=for-the-badge
[forks-url]: https://github.com/skullgaming31/opendevbot-Twitch/network/members
[stars-shield]: https://img.shields.io/github/stars/skullgaming31/opendevbot-Twitch.svg?style=for-the-badge
[stars-url]: https://github.com/skullgaming31/opendevbot-Twitch/stargazers
[issues-shield]: https://img.shields.io/github/issues/skullgaming31/opendevbot-Twitch.svg?style=for-the-badge
[issues-url]: https://github.com/skullgaming31/opendevbot-Twitch/issues
[license-shield]: https://img.shields.io/github/license/skullgaming31/opendevbot-Twitch.svg?style=for-the-badge
[license-url]: https://github.com/skullgaming31/opendevbot-Twitch/blob/main/LICENSE