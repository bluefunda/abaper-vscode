# bluefunda.com/login — Redirect for VS Code Extension

The VS Code extension opens `bluefunda.com/login` with a `redirect_uri` query parameter. The page needs to read that parameter and redirect the user to it.

## Example URL the extension opens

```
https://bluefunda.com/login?redirect_uri=https%3A%2F%2Fai.bluefunda.com%2Frealms%2Findividual%2Fdevice%3Fuser_code%3DABCD-EFGH&utm_source=vscode-extension&utm_medium=command&utm_campaign=login
```

## What the page should do

1. Let GA fire (page load captures the UTM params automatically)
2. Read the `redirect_uri` query param
3. Redirect the user to that URL (the Keycloak device verification page)
4. If no `redirect_uri` param is present, show the normal login flow (existing behavior for web users)

## Example implementation

```javascript
const params = new URLSearchParams(window.location.search);
const redirect = params.get('redirect_uri');
if (redirect) {
  window.location.href = redirect;
}
```
