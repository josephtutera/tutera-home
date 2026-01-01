"""
Apple TV Remote Control Service

A FastAPI service that provides REST API endpoints for controlling Apple TV devices
using the pyatv library. This service runs alongside the Next.js Tutera-Home app
and provides full remote control functionality including D-pad navigation,
transport controls, and now playing information.

Usage:
    uvicorn main:app --host 0.0.0.0 --port 8000

Environment Variables:
    APPLETV_SCAN_TIMEOUT: Timeout for scanning Apple TVs (default: 5 seconds)
    APPLETV_PAIR_PIN: Default PIN for pairing (prompted during first run)
"""

import asyncio
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pyatv
from pyatv.const import Protocol, DeviceState, FeatureName, FeatureState

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache for discovered Apple TVs and active connections
discovered_devices: dict[str, pyatv.interface.BaseConfig] = {}
active_connections: dict[str, pyatv.interface.AppleTV] = {}

# Lock for connection management
connection_lock = asyncio.Lock()


class DeviceInfo(BaseModel):
    """Apple TV device information"""
    id: str
    name: str
    address: str
    model: Optional[str] = None
    os_version: Optional[str] = None
    is_connected: bool = False


class NowPlayingInfo(BaseModel):
    """Current media playing information"""
    device_id: str
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    genre: Optional[str] = None
    media_type: Optional[str] = None
    device_state: str = "unknown"
    position: Optional[int] = None
    total_time: Optional[int] = None
    repeat: Optional[str] = None
    shuffle: Optional[str] = None
    app_name: Optional[str] = None
    app_id: Optional[str] = None


class RemoteCommand(BaseModel):
    """Remote control command"""
    command: str  # up, down, left, right, select, menu, home, play_pause, etc.


class PairingRequest(BaseModel):
    """Pairing request with PIN"""
    pin: str


async def scan_apple_tvs(timeout: float = 5.0) -> list[pyatv.interface.BaseConfig]:
    """Scan the network for Apple TV devices"""
    logger.info(f"Scanning for Apple TVs (timeout: {timeout}s)...")
    devices = await pyatv.scan(asyncio.get_event_loop(), timeout=timeout)
    logger.info(f"Found {len(devices)} Apple TV(s)")
    return devices


async def get_or_create_connection(device_id: str) -> pyatv.interface.AppleTV:
    """Get existing connection or create a new one"""
    async with connection_lock:
        # Check if we already have an active connection
        if device_id in active_connections:
            atv = active_connections[device_id]
            # Verify connection is still alive
            try:
                # Try to access a property to verify connection
                _ = atv.device_info
                return atv
            except Exception:
                # Connection is stale, remove it
                logger.warning(f"Stale connection for {device_id}, reconnecting...")
                try:
                    atv.close()
                except Exception:
                    pass
                del active_connections[device_id]
        
        # Get device config from cache
        if device_id not in discovered_devices:
            # Rescan to find the device
            devices = await scan_apple_tvs()
            for device in devices:
                discovered_devices[device.identifier] = device
        
        if device_id not in discovered_devices:
            raise HTTPException(status_code=404, detail=f"Apple TV {device_id} not found")
        
        config = discovered_devices[device_id]
        
        # Connect to the device
        logger.info(f"Connecting to Apple TV: {config.name}")
        try:
            atv = await pyatv.connect(config, asyncio.get_event_loop())
            active_connections[device_id] = atv
            logger.info(f"Connected to {config.name}")
            return atv
        except Exception as e:
            logger.error(f"Failed to connect to {config.name}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to connect: {str(e)}")


async def close_all_connections():
    """Close all active Apple TV connections"""
    async with connection_lock:
        for device_id, atv in active_connections.items():
            try:
                atv.close()
                logger.info(f"Closed connection to {device_id}")
            except Exception as e:
                logger.warning(f"Error closing connection to {device_id}: {e}")
        active_connections.clear()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - handle startup and shutdown"""
    # Startup: scan for devices
    logger.info("Starting Apple TV Control Service...")
    try:
        devices = await scan_apple_tvs()
        for device in devices:
            discovered_devices[device.identifier] = device
            logger.info(f"  Found: {device.name} ({device.identifier})")
    except Exception as e:
        logger.warning(f"Initial scan failed: {e}")
    
    yield
    
    # Shutdown: close all connections
    logger.info("Shutting down Apple TV Control Service...")
    await close_all_connections()


# Create FastAPI app
app = FastAPI(
    title="Apple TV Control Service",
    description="REST API for controlling Apple TV devices via pyatv",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware for cross-origin requests from Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Device Discovery and Management
# ============================================================================

@app.get("/devices", response_model=list[DeviceInfo])
async def list_devices():
    """List all discovered Apple TV devices"""
    devices = []
    for device_id, config in discovered_devices.items():
        devices.append(DeviceInfo(
            id=device_id,
            name=config.name,
            address=str(config.address),
            is_connected=device_id in active_connections,
        ))
    return devices


@app.post("/devices/scan", response_model=list[DeviceInfo])
async def rescan_devices():
    """Rescan the network for Apple TV devices"""
    global discovered_devices
    
    try:
        devices = await scan_apple_tvs()
        discovered_devices.clear()
        
        result = []
        for device in devices:
            discovered_devices[device.identifier] = device
            result.append(DeviceInfo(
                id=device.identifier,
                name=device.name,
                address=str(device.address),
                is_connected=device.identifier in active_connections,
            ))
        return result
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


@app.get("/devices/{device_id}", response_model=DeviceInfo)
async def get_device(device_id: str):
    """Get information about a specific Apple TV"""
    if device_id not in discovered_devices:
        raise HTTPException(status_code=404, detail="Device not found")
    
    config = discovered_devices[device_id]
    
    device_info = DeviceInfo(
        id=device_id,
        name=config.name,
        address=str(config.address),
        is_connected=device_id in active_connections,
    )
    
    # If connected, get additional info
    if device_id in active_connections:
        try:
            atv = active_connections[device_id]
            info = atv.device_info
            device_info.model = info.model
            device_info.os_version = info.version
        except Exception:
            pass
    
    return device_info


# ============================================================================
# Pairing
# ============================================================================

@app.post("/devices/{device_id}/pair/start")
async def start_pairing(device_id: str, protocol: str = "companion"):
    """
    Start pairing process with an Apple TV (displays PIN on TV)
    
    Protocol options:
    - companion: For navigation/remote control (recommended for Apple TV 4K)
    - airplay: For media playback only
    """
    if device_id not in discovered_devices:
        raise HTTPException(status_code=404, detail="Device not found")
    
    config = discovered_devices[device_id]
    
    # Select protocol based on parameter
    proto = Protocol.Companion if protocol.lower() == "companion" else Protocol.AirPlay
    
    try:
        # Use Companion protocol for full remote control
        pairing = await pyatv.pair(config, proto, asyncio.get_event_loop())
        await pairing.begin()
        
        # Store pairing session for later completion
        app.state.pairing_sessions = getattr(app.state, 'pairing_sessions', {})
        app.state.pairing_sessions[device_id] = pairing
        
        return {
            "message": f"Pairing started with {protocol} protocol. Enter the PIN shown on your Apple TV.",
            "protocol": protocol,
            "requires_pin": True
        }
    except Exception as e:
        logger.error(f"Failed to start pairing: {e}")
        raise HTTPException(status_code=500, detail=f"Pairing failed: {str(e)}")


@app.post("/devices/{device_id}/pair/finish")
async def finish_pairing(device_id: str, request: PairingRequest):
    """Complete pairing by submitting the PIN from the TV"""
    pairing_sessions = getattr(app.state, 'pairing_sessions', {})
    
    if device_id not in pairing_sessions:
        raise HTTPException(status_code=400, detail="No active pairing session")
    
    pairing = pairing_sessions[device_id]
    
    try:
        pairing.pin(request.pin)
        await pairing.finish()
        
        # Store credentials
        if pairing.has_paired:
            credentials = pairing.service.credentials
            logger.info(f"Pairing successful! Credentials: {credentials}")
            
            # Clean up
            del pairing_sessions[device_id]
            
            return {"message": "Pairing successful", "credentials": credentials}
        else:
            raise HTTPException(status_code=400, detail="Pairing not completed")
    except Exception as e:
        logger.error(f"Failed to finish pairing: {e}")
        raise HTTPException(status_code=500, detail=f"Pairing failed: {str(e)}")


# ============================================================================
# Remote Control Commands
# ============================================================================

@app.post("/devices/{device_id}/remote/{command}")
async def send_remote_command(device_id: str, command: str):
    """
    Send a remote control command to the Apple TV
    
    Available commands:
    - Navigation: up, down, left, right, select, menu, home, top_menu
    - Playback: play, pause, play_pause, stop, next, previous
    - Volume: volume_up, volume_down
    - Other: skip_forward, skip_backward
    """
    atv = await get_or_create_connection(device_id)
    remote = atv.remote_control
    
    # Map command strings to remote control method names
    # We use getattr to safely get methods that may or may not exist
    command_names = {
        # Navigation
        "up": "up",
        "down": "down",
        "left": "left",
        "right": "right",
        "select": "select",
        "menu": "menu",
        "home": "home",
        "top_menu": "top_menu",
        
        # Playback
        "play": "play",
        "pause": "pause",
        "play_pause": "play_pause",
        "stop": "stop",
        "next": "next",
        "previous": "previous",
        "skip_forward": "skip_forward",
        "skip_backward": "skip_backward",
        
        # Volume
        "volume_up": "volume_up",
        "volume_down": "volume_down",
    }
    
    if command not in command_names:
        available = ", ".join(command_names.keys())
        raise HTTPException(
            status_code=400, 
            detail=f"Unknown command: {command}. Available: {available}"
        )
    
    method_name = command_names[command]
    method = getattr(remote, method_name, None)
    
    if method is None:
        raise HTTPException(
            status_code=400,
            detail=f"Command '{command}' not supported by this Apple TV"
        )
    
    try:
        await method()
        return {"success": True, "command": command}
    except Exception as e:
        logger.error(f"Command {command} failed: {e}")
        raise HTTPException(status_code=500, detail=f"Command failed: {str(e)}")


# ============================================================================
# Now Playing Information
# ============================================================================

@app.get("/devices/{device_id}/now_playing", response_model=NowPlayingInfo)
async def get_now_playing(device_id: str):
    """Get current now playing information from the Apple TV"""
    atv = await get_or_create_connection(device_id)
    
    try:
        playing = atv.metadata
        push_updater = atv.push_updater
        
        # Get current playing info
        result = NowPlayingInfo(device_id=device_id)
        
        # Get basic metadata
        try:
            current = await playing.playing()
            
            result.title = current.title
            result.artist = current.artist
            result.album = current.album
            result.genre = current.genre
            result.media_type = str(current.media_type) if current.media_type else None
            result.device_state = str(current.device_state) if current.device_state else "unknown"
            result.position = current.position
            result.total_time = current.total_time
            result.repeat = str(current.repeat) if current.repeat else None
            result.shuffle = str(current.shuffle) if current.shuffle else None
        except Exception as e:
            logger.warning(f"Could not get playing info: {e}")
        
        # Get app info if available
        try:
            if atv.features.in_state(FeatureState.Available, FeatureName.App):
                app_info = await playing.app()
                if app_info:
                    result.app_name = app_info.name
                    result.app_id = app_info.identifier
        except Exception as e:
            logger.warning(f"Could not get app info: {e}")
        
        return result
    except Exception as e:
        logger.error(f"Failed to get now playing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get now playing: {str(e)}")


# ============================================================================
# App Launching
# ============================================================================

@app.post("/devices/{device_id}/apps/{app_id}/launch")
async def launch_app(device_id: str, app_id: str):
    """Launch an app on the Apple TV by its bundle ID"""
    atv = await get_or_create_connection(device_id)
    
    try:
        if not atv.features.in_state(FeatureState.Available, FeatureName.LaunchApp):
            raise HTTPException(status_code=400, detail="App launching not supported")
        
        await atv.apps.launch_app(app_id)
        return {"success": True, "app_id": app_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to launch app {app_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to launch app: {str(e)}")


@app.get("/devices/{device_id}/apps")
async def list_apps(device_id: str):
    """List available apps on the Apple TV"""
    atv = await get_or_create_connection(device_id)
    
    try:
        if not atv.features.in_state(FeatureState.Available, FeatureName.AppList):
            return {"apps": [], "message": "App listing not supported on this device"}
        
        apps = await atv.apps.app_list()
        return {"apps": [{"id": app.identifier, "name": app.name} for app in apps]}
    except Exception as e:
        logger.error(f"Failed to list apps: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list apps: {str(e)}")


# ============================================================================
# Connection Management
# ============================================================================

@app.post("/devices/{device_id}/connect")
async def connect_device(device_id: str):
    """Explicitly connect to an Apple TV"""
    atv = await get_or_create_connection(device_id)
    return {
        "success": True,
        "device_id": device_id,
        "name": discovered_devices[device_id].name if device_id in discovered_devices else "Unknown"
    }


@app.post("/devices/{device_id}/disconnect")
async def disconnect_device(device_id: str):
    """Disconnect from an Apple TV"""
    async with connection_lock:
        if device_id in active_connections:
            try:
                active_connections[device_id].close()
            except Exception:
                pass
            del active_connections[device_id]
            return {"success": True, "message": f"Disconnected from {device_id}"}
        return {"success": True, "message": "Device was not connected"}


# ============================================================================
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "discovered_devices": len(discovered_devices),
        "active_connections": len(active_connections),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
