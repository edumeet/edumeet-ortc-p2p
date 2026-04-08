# Contributing
Below are a few guidelines that should help you prepare if you want to contribute to this project.

## Reach out

Before you start to code, create an issue describing what you want to do. Perhaps someone else is already doing similar work. Or perhaps the topic of interest has already been discussed and rejected for a reason. The maintainers will point you in the right direction.

## Development

The following steps will get you setup to contribute changes to this repo:

1. Fork this repo.

2. Clone your forked repo: `git clone git@github.com:{your_username}/edumeet-ortc-p2p.git`

3. This project uses **Yarn 4** (Berry) via Corepack. Enable it first:
   ```bash
   export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
   corepack enable
   ```

4. Install dependencies:

   **For development** (allows lockfile changes when adding/upgrading packages):
   ```bash
   yarn install
   ```

   **For building from source** (uses exact lockfile, same as CI/Docker):
   ```bash
   yarn install --immutable
   ```

5. Build the project:
   ```bash
   yarn build
   ```

6. Create pull request to the main branch.

### Documentation

Our documentation lives in README.md. Be sure to document any changes you implement.

## License

By contributing your code to this repository, you agree to license your contribution under the ISC license.
