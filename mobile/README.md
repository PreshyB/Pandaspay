# PayTight — Mobile

React Native app (Expo + TypeScript) for the PayTight buyer and seller flows, against the same backend as `../web`.

## Run it on your phone (Expo Go)

You need Node 22 or newer, the backend running (`../backend/README.md`), and your phone on the **same Wi-Fi** as your computer.

```bash
cd mobile
npm install
npx expo install --fix     # lines every Expo package up with the Expo SDK (do this once, and after any upgrade)
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iPhone).

### If Expo Go shows an error

| What it says | What to do |
| --- | --- |
| "Project is incompatible with this version of Expo Go" / SDK version mismatch | Expo Go only opens the SDK it was built for. Move the project to that SDK: `npx expo install expo@^NN.0.0 --fix` (NN is the SDK number in the message), then `npx expo start -c`. |
| Red screen with "Unable to resolve module" or a stale bundle | `npx expo start -c` (clears the cache). If it persists: delete `node_modules` and run `npm install && npx expo install --fix`. |
| "Can't reach the PayTight server at http://…:3000" | Start the backend, keep phone and computer on the same Wi-Fi, and allow port 3000 through your computer's firewall. On guest or office Wi-Fi that isolates devices, use `npx expo start --tunnel` and run the backend through a tunnel (set `EXPO_PUBLIC_API_BASE_URL`, below). |
| Anything else | `npx expo-doctor` lists mismatched packages. |

### Where the app finds the backend

The app works this out by itself: it uses the address of the computer running `expo start`, port 3000. Override it by creating `mobile/.env`:

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.23:3000
```

## What's here

- **Sign in** with an email code (create an account first if you are new). While the backend runs without an email provider, the code is shown on screen in the test version.
- **Buyer**: enter a product code → product screen (photo, choices such as size or colour) → buy now → order status with the order and payment-protection badges kept separate → confirm delivery or open a dispute.
- **Seller**: apply to sell (an admin approves you on the web at `/admin/sellers`), then list products and accept, decline and ship orders.

Not in the app yet: product photo upload, delivery zones and fees, payouts, the cart and seller dashboard redesign. Those are on the web for now.
