# Apple TV Pairing Guide

This guide walks you through pairing your Apple TVs with the pyatv service running on your Synology NAS.

## Prerequisites

- pyatv service running on Synology at `http://192.168.20.2:8000`
- Access to view the Apple TV screens (for PIN entry)

---

## Your Apple TVs

| Name | IP Address | Device ID |
|------|------------|-----------|
| Apple TV 1 | 192.168.20.117 | `EA:CD:C6:C5:DC:59` |
| Apple 2 | 192.168.20.129 | `52:7C:92:DA:40:84` |
| Apple 3 | 192.168.20.253 | `4E:55:76:4B:18:92` |

---

## Step 1: Open the pyatv API Interface

Open your browser and go to:
```
http://192.168.20.2:8000/docs
```

This is the FastAPI Swagger UI where you can interact with all the endpoints.

---

## Step 2: Pair Each Apple TV (IMPORTANT: Use Companion Protocol)

**For navigation commands (D-pad, menu, etc.) to work, you MUST pair with the Companion protocol.**

Repeat these steps for each Apple TV:

### 2a. Start Pairing with Companion Protocol

1. In the Swagger UI, scroll down to find **POST /devices/{device_id}/pair/start**
2. Click on it to expand
3. Click **"Try it out"**
4. Enter:
   - **device_id**: `EA:CD:C6:C5:DC:59` (for Apple TV 1)
   - **protocol**: `companion` (THIS IS CRITICAL - not airplay!)
5. Click **"Execute"**
6. **LOOK AT YOUR TV** - A 4-digit PIN will appear on the screen

### 2b. Finish Pairing

1. Find **POST /devices/{device_id}/pair/finish**
2. Click on it to expand
3. Click **"Try it out"**
4. In the `device_id` field, enter the same Device ID
5. In the **Request body**, enter:
   ```json
   {
     "pin": "1234"
   }
   ```
   (Replace `1234` with the actual PIN shown on your TV)
6. Click **"Execute"**
7. You should see a success response with credentials

### Why Companion Protocol?

| Protocol | Supports |
|----------|----------|
| **companion** | Navigation (up/down/left/right/select/menu/home), playback |
| airplay | Media playback only (no navigation) |

**Always use `companion` for full remote control!**

### 2c. Verify Pairing Worked

1. Find **POST /devices/{device_id}/remote/{command}**
2. Click "Try it out"
3. Enter the Device ID
4. For `command`, enter: `menu`
5. Click Execute
6. Your Apple TV should respond (you'll see it react on screen)

---

## Step 3: Repeat for All Apple TVs

| Apple TV | Device ID to Enter |
|----------|-------------------|
| Apple TV 1 | `EA:CD:C6:C5:DC:59` |
| Apple 2 | `52:7C:92:DA:40:84` |
| Apple 3 | `4E:55:76:4B:18:92` |

---

## Available Remote Commands

Once paired, you can send these commands via **POST /devices/{device_id}/remote/{command}**:

### Navigation
- `up` - D-pad up
- `down` - D-pad down
- `left` - D-pad left
- `right` - D-pad right
- `select` - Center button (OK/Enter)
- `menu` - Menu button (back)
- `home` - Home button (TV button)
- `top_menu` - Top menu

### Playback
- `play` - Play
- `pause` - Pause
- `play_pause` - Toggle play/pause
- `stop` - Stop
- `next` - Next track/chapter
- `previous` - Previous track/chapter
- `skip_forward` - Skip forward
- `skip_backward` - Skip backward

### Volume
- `volume_up` - Volume up
- `volume_down` - Volume down

### Power
- `turn_on` - Turn on
- `turn_off` - Turn off (sleep)

---

## Step 4: Test in Tutera-Home App

After pairing, the D-pad controls in Tutera-Home should work:

1. Open Tutera-Home in your browser
2. Go to the Media page
3. Select a room with Apple TV as the source (e.g., Kitchen)
4. The Apple TV Remote section should now control the TV!

---

## Troubleshooting

### "Device not found" error
Run a new scan first:
- **POST /devices/scan** → Execute
- Then try pairing again

### Pairing times out
- Make sure the Apple TV is awake (not in sleep mode)
- Try pressing a button on the physical Apple TV remote first
- Then start the pairing process again

### PIN doesn't appear on TV
- The Apple TV may be asleep
- Wake it up with the physical remote
- Try the pair/start endpoint again

### Connection refused from Tutera-Home
Make sure the app is configured to use the Synology:
- Check that `PYATV_SERVICE_URL=http://192.168.20.2:8000` is set in `.env.local`

---

## Quick Reference URLs

| URL | Purpose |
|-----|---------|
| http://192.168.20.2:8000/docs | API documentation (Swagger UI) |
| http://192.168.20.2:8000/devices | List all discovered devices |
| http://192.168.20.2:8000/devices/scan | Rescan for devices |
| http://192.168.20.2:8000/health | Service health check |

---

## Other Detected Devices (For Reference)

These are AirPlay-enabled devices that were detected but are NOT Apple TVs:

| Name | Type | IP Address |
|------|------|------------|
| 75" The Frame | Samsung TV | 192.168.20.131 |
| 75" The Frame | Samsung TV | 192.168.20.191 |
| Samsung The Frame 50 | Samsung TV | 192.168.20.238 |
| Sonos | Speaker | 192.168.20.234 |
| Virtual TV Joe's Office | Virtual Device | 192.168.20.97 |
| Hannah's Bedroom | Crestron/Other | 192.168.20.107 |
| Lower Galleries | Crestron/Other | 192.168.20.71 |
| Upper Commons | Crestron/Other | 192.168.20.232 |
| Dining Room | Crestron/Other | 192.168.20.203 |

You can potentially control some of these via AirPlay as well, but the D-pad controls are designed for Apple TVs.
