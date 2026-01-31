# mull2five.github.io
GitHub page of Mull to Five

## Building the site locally

This site is built with Jekyll and is compatible with Ruby 3.2+ and Ruby 4.0.

### Prerequisites

1.  **Ruby 4.0 or 3.2**: Ensure you have Ruby installed.
2.  **DevKit (Required for Windows)**:
    Since Jekyll and its dependencies (like `google-protobuf` and `eventmachine`) require compiling native extensions on Windows, you **must** install the MSYS2 DevKit. Run:
    ```bash
    ridk install
    ```
    Select option `3` (MSYS2 and MINGW development tools). Without this, `bundle install` will fail.

### Installation and Usage

1. Install dependencies:
   ```bash
   bundle install
   ```

2. Build the site:
   ```bash
   bundle exec jekyll build
   ```
   The output will be in the `_site` directory.

3. Serve the site locally:
   ```bash
   bundle exec jekyll serve
   ```
