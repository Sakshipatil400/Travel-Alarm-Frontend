import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { getApiErrorMessage } from "../utils/errorHandler";
import Navbar from "../components/Navbar";
import "./ActiveTrip.css";

// Helper to detect raw GUIDs to prevent displaying GUIDs in UI
const isRawGuid = (val) =>
    typeof val === "string" &&
    (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()) ||
        val.trim().toLowerCase().startsWith("destination #"));

function ActiveTrip() {
    const navigate = useNavigate();
    // 1. Active trip is loaded from localStorage using "activeTrip"
    const [trip, setTrip] = useState(() => {
        try {
            const savedTrip = localStorage.getItem("activeTrip");
            return savedTrip ? JSON.parse(savedTrip) : null;
        } catch {
            return null;
        }
    });

    const [location, setLocation] = useState(null);
    const [result, setResult] = useState(null);
    const [message, setMessage] = useState(() => {
        try {
            const savedTrip = localStorage.getItem("activeTrip");
            return savedTrip ? "" : "No active trip found.";
        } catch {
            return "No active trip found.";
        }
    });
    const [alarmPlayed, setAlarmPlayed] = useState(false);
    const [trackingActive, setTrackingActive] = useState(() => {
        try {
            const savedTrip = localStorage.getItem("activeTrip");
            return Boolean(savedTrip);
        } catch {
            return false;
        }
    });

    // Loading states to prevent duplicate actions
    const [isCheckingLocation, setIsCheckingLocation] = useState(false);
    const [isStoppingTrip, setIsStoppingTrip] = useState(false);

    // Destination name display state
    const [destinationName, setDestinationName] = useState(() => {
        try {
            const savedTrip = localStorage.getItem("activeTrip");
            if (savedTrip) {
                const parsed = JSON.parse(savedTrip);
                if (parsed.destinationName && !isRawGuid(parsed.destinationName)) {
                    return parsed.destinationName;
                }
                if (
                    parsed.destination &&
                    typeof parsed.destination === "object" &&
                    parsed.destination.name &&
                    !isRawGuid(parsed.destination.name)
                ) {
                    return parsed.destination.name;
                }
                if (
                    typeof parsed.destination === "string" &&
                    parsed.destination.trim() &&
                    !isRawGuid(parsed.destination)
                ) {
                    return parsed.destination;
                }
            }
        } catch {
            // ignore JSON parse error
        }
        return "";
    });

    // Store browser GPS watcher ID & refs
    const watchIdRef = useRef(null);
    const tripRef = useRef(trip);
    const alarmPlayedRef = useRef(alarmPlayed);
    const latestLocationRef = useRef(null);
    const audioContextRef = useRef(null);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const alarmIntervalRef = useRef(null);
    const activeTimeoutsRef = useRef([]);
    const currentOscillatorRef = useRef(null);
    const isAlarmRunningRef = useRef(false);

    useEffect(() => {
        tripRef.current = trip;
    }, [trip]);

    useEffect(() => {
        alarmPlayedRef.current = alarmPlayed;
    }, [alarmPlayed]);

    // Sync trip state with localStorage on window focus or storage changes
    useEffect(() => {
        const handleSync = () => {
            try {
                const saved = localStorage.getItem("activeTrip");
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setTrip(parsed);
                    tripRef.current = parsed;
                    setTrackingActive(true);
                }
            } catch {
                // ignore
            }
        };

        window.addEventListener("storage", handleSync);
        window.addEventListener("focus", handleSync);

        return () => {
            window.removeEventListener("storage", handleSync);
            window.removeEventListener("focus", handleSync);
        };
    }, []);

    const resolvedDestinationName =
        destinationName ||
        (trip?.destinationName && !isRawGuid(trip.destinationName) ? trip.destinationName : "") ||
        (trip?.destination &&
            typeof trip.destination === "object" &&
            trip.destination.name &&
            !isRawGuid(trip.destination.name)
            ? trip.destination.name
            : "") ||
        (typeof trip?.destination === "string" &&
            trip.destination.trim() &&
            !isRawGuid(trip.destination)
            ? trip.destination
            : "");

    const isLoadingDestination = Boolean(trip?.destinationId && !resolvedDestinationName);

    // Helper to get or create an AudioContext
    const getOrCreateAudioContext = useCallback(() => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
            audioContextRef.current = new AudioCtx();
        }
        return audioContextRef.current;
    }, []);

    // Unlock AudioContext on any user interaction with the page to make audio reliable
    useEffect(() => {
        const unlockAudio = async () => {
            try {
                const ctx = getOrCreateAudioContext();
                if (ctx && ctx.state === "suspended") {
                    await ctx.resume();
                }
            } catch {
                // ignore
            }
        };

        window.addEventListener("click", unlockAudio);
        window.addEventListener("touchstart", unlockAudio);
        window.addEventListener("keydown", unlockAudio);

        return () => {
            window.removeEventListener("click", unlockAudio);
            window.removeEventListener("touchstart", unlockAudio);
            window.removeEventListener("keydown", unlockAudio);
        };
    }, [getOrCreateAudioContext]);

    // Play single oscillator tone (sine wave 1000Hz for 1s)
    const playSingleBeep = useCallback(() => {
        const ctx = getOrCreateAudioContext();
        if (!ctx) return;

        try {
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => {});
            }
        } catch {
            // ignore
        }

        if (ctx.state !== "running") {
            setAudioBlocked(true);
            return;
        }

        setAudioBlocked(false);

        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = "sine";
            oscillator.frequency.value = 1000;
            gainNode.gain.value = 0.5;

            currentOscillatorRef.current = oscillator;

            oscillator.start();

            const timeoutId = setTimeout(() => {
                try {
                    oscillator.stop();
                } catch {
                    // ignore if already stopped
                }
                if (currentOscillatorRef.current === oscillator) {
                    currentOscillatorRef.current = null;
                }
                activeTimeoutsRef.current = activeTimeoutsRef.current.filter(
                    (id) => id !== timeoutId
                );
            }, 1000);

            activeTimeoutsRef.current.push(timeoutId);
        } catch (err) {
            console.error("Oscillator play error:", err);
        }
    }, [getOrCreateAudioContext]);

    // Start repeating alarm loop continuously
    const startAlarmLoop = useCallback(() => {
        // Prevent multiple overlapping alarm loops
        if (isAlarmRunningRef.current) {
            return;
        }

        isAlarmRunningRef.current = true;
        setAlarmPlayed(true);
        alarmPlayedRef.current = true;

        // Play first beep immediately
        playSingleBeep();

        if (alarmIntervalRef.current) {
            clearInterval(alarmIntervalRef.current);
        }

        alarmIntervalRef.current = setInterval(() => {
            if (!isAlarmRunningRef.current) {
                if (alarmIntervalRef.current) {
                    clearInterval(alarmIntervalRef.current);
                    alarmIntervalRef.current = null;
                }
                return;
            }
            playSingleBeep();
        }, 1500);
    }, [playSingleBeep]);

    // Stop repeating alarm immediately and clear all timers/oscillators
    const stopAlarmLoop = useCallback(() => {
        isAlarmRunningRef.current = false;
        alarmPlayedRef.current = false;
        setAlarmPlayed(false);
        setAudioBlocked(false);

        if (alarmIntervalRef.current) {
            clearInterval(alarmIntervalRef.current);
            alarmIntervalRef.current = null;
        }

        if (activeTimeoutsRef.current) {
            activeTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
            activeTimeoutsRef.current = [];
        }

        if (currentOscillatorRef.current) {
            try {
                currentOscillatorRef.current.stop();
            } catch {
                // ignore
            }
            currentOscillatorRef.current = null;
        }
    }, []);

    // Handler to enable audio and play alarm on user gesture when autoplay is blocked
    const handleEnableAudio = useCallback(async () => {
        const ctx = getOrCreateAudioContext();
        if (ctx) {
            try {
                await ctx.resume();
                if (ctx.state === "running") {
                    setAudioBlocked(false);
                    if (isAlarmRunningRef.current) {
                        playSingleBeep();
                    }
                }
            } catch (e) {
                console.error("Audio resume error:", e);
            }
        }
    }, [getOrCreateAudioContext, playSingleBeep]);

    // Listen for user tap when audio is blocked
    useEffect(() => {
        if (!audioBlocked) return;

        const onUserGesture = () => {
            handleEnableAudio();
        };

        window.addEventListener("click", onUserGesture, { once: true });
        window.addEventListener("touchstart", onUserGesture, { once: true });

        return () => {
            window.removeEventListener("click", onUserGesture);
            window.removeEventListener("touchstart", onUserGesture);
        };
    }, [audioBlocked, handleEnableAudio]);

    // Cleanup repeating alarm and audio context on unmount
    useEffect(() => {
        return () => {
            stopAlarmLoop();
            if (audioContextRef.current && audioContextRef.current.state !== "closed") {
                try {
                    audioContextRef.current.close();
                } catch {
                    // ignore
                }
                audioContextRef.current = null;
            }
        };
    }, [stopAlarmLoop]);

    // Stop GPS watcher
    const stopLocationTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setTrackingActive(false);
    }, []);

    // Send location to backend
    const sendLocationToBackend = useCallback(
        async (latitude, longitude) => {
            // Safely resolve the active trip ID from state, ref, or localStorage
            let currentTrip = trip || tripRef.current;
            if (!currentTrip?.id) {
                try {
                    const saved = localStorage.getItem("activeTrip");
                    if (saved) {
                        currentTrip = JSON.parse(saved);
                    }
                } catch {
                    // ignore
                }
            }

            if (!currentTrip || !currentTrip.id) {
                return;
            }

            const tripId = currentTrip.id;

            setLocation({
                latitude,
                longitude
            });

            try {
                const response = await api.post(
                    `/Trips/${tripId}/location`,
                    {
                        latitude,
                        longitude
                    }
                );

                console.log("Location response:", response.data);
                setResult(response.data);

                const isAlertTriggered = Boolean(
                    response.data?.triggered ?? response.data?.Triggered
                );

                if (isAlertTriggered) {
                    setMessage("🚨 You have reached the alert distance!");

                    // Start repeating alarm if not already running
                    if (!isAlarmRunningRef.current) {
                        startAlarmLoop();
                    }
                } else {
                    setMessage("Location updated automatically.");
                }
            } catch (error) {
                console.error("Location update error:", error);
                const errMsg = getApiErrorMessage(error, "Unable to update location.");
                setMessage(errMsg);
                if (error.response?.status === 401) {
                    stopLocationTracking();
                    stopAlarmLoop();
                    localStorage.removeItem("token");
                    setTimeout(() => navigate("/login", { state: { message: errMsg } }), 1200);
                }
            }
        },
        [trip, stopLocationTracking, startAlarmLoop, stopAlarmLoop, navigate]
    );

    // Start GPS tracking via navigator.geolocation.watchPosition
    useEffect(() => {
        if (!trip) {
            return;
        }

        if (!navigator.geolocation) {
            const timer = setTimeout(() => {
                setMessage("Geolocation is not supported by this browser.");
                setTrackingActive(false);
            }, 0);
            return () => clearTimeout(timer);
        }

        // Prevent multiple watchers
        if (watchIdRef.current !== null) {
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                console.log("New GPS location:", latitude, longitude);

                latestLocationRef.current = { latitude, longitude };
                setLocation({ latitude, longitude });

                sendLocationToBackend(latitude, longitude);
            },
            (error) => {
                console.error("GPS error:", error);
                setMessage(
                    "Unable to get your location. Please allow location access."
                );
                setTrackingActive(false);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
            }
        );

        watchIdRef.current = watchId;

        // Cleanup when leaving page
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [trip, sendLocationToBackend]);

    // Fetch destination name matching trip.destinationId from existing Destinations API
    useEffect(() => {
        const tripDestName =
            (trip?.destinationName && !isRawGuid(trip.destinationName) ? trip.destinationName : "") ||
            (trip?.destination &&
                typeof trip.destination === "object" &&
                trip.destination.name &&
                !isRawGuid(trip.destination.name)
                ? trip.destination.name
                : "") ||
            (typeof trip?.destination === "string" &&
                trip.destination.trim() &&
                !isRawGuid(trip.destination)
                ? trip.destination
                : "");

        if (!trip?.destinationId || destinationName || tripDestName) {
            return;
        }

        let isMounted = true;

        const fetchDestinationName = async () => {
            try {
                const response = await api.get("/Destinations");
                if (!isMounted) return;

                const destinations = response.data;
                if (Array.isArray(destinations)) {
                    const matched = destinations.find(
                        (destination) =>
                            destination.id === trip.destinationId ||
                            String(destination.id).toLowerCase() === String(trip.destinationId).toLowerCase()
                    );

                    if (matched && matched.name) {
                        setDestinationName(matched.name);

                        try {
                            const saved = localStorage.getItem("activeTrip");
                            if (saved) {
                                const parsed = JSON.parse(saved);
                                if (parsed.id === trip.id) {
                                    parsed.destinationName = matched.name;
                                    localStorage.setItem("activeTrip", JSON.stringify(parsed));
                                }
                            }
                        } catch {
                            // ignore localStorage error
                        }
                        return;
                    }
                }
                setDestinationName("Destination");
            } catch (error) {
                console.error("Unable to load destination name:", error);
                if (isMounted) {
                    setDestinationName("Destination");
                }
                if (error.response?.status === 401) {
                    const errMsg = getApiErrorMessage(error);
                    setMessage(errMsg);
                    localStorage.removeItem("token");
                    navigate("/login", { state: { message: errMsg } });
                }
            }
        };

        fetchDestinationName();

        return () => {
            isMounted = false;
        };
    }, [trip, destinationName, navigate]);

    // Manual location check (Check Location Now)
    const getLocationNow = async () => {
        let currentTrip = trip || tripRef.current;
        if (!currentTrip?.id) {
            try {
                const saved = localStorage.getItem("activeTrip");
                if (saved) {
                    currentTrip = JSON.parse(saved);
                }
            } catch {
                // ignore
            }
        }

        if (!currentTrip || !currentTrip.id || isCheckingLocation || isStoppingTrip) {
            if (!currentTrip || !currentTrip.id) {
                setMessage("No active trip found.");
            }
            return;
        }

        setIsCheckingLocation(true);
        setMessage("Getting current location...");

        if (!navigator.geolocation) {
            setMessage("Geolocation is not supported by this browser.");
            setIsCheckingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                console.log("New GPS location:", latitude, longitude);

                latestLocationRef.current = { latitude, longitude };
                setLocation({ latitude, longitude });

                try {
                    await sendLocationToBackend(latitude, longitude);
                } finally {
                    setIsCheckingLocation(false);
                }
            },
            async (error) => {
                console.error("GPS error:", error);
                // Fallback: If getCurrentPosition fails but we have latestLocationRef, use it
                if (latestLocationRef.current) {
                    try {
                        const { latitude, longitude } = latestLocationRef.current;
                        await sendLocationToBackend(latitude, longitude);
                    } catch (err) {
                        console.error(err);
                    } finally {
                        setIsCheckingLocation(false);
                    }
                } else {
                    setMessage("Unable to get your location. Please allow location access.");
                    setIsCheckingLocation(false);
                }
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 15000
            }
        );
    };

    // Stop trip
    const stopTrip = async () => {
        let currentTrip = trip || tripRef.current;
        if (!currentTrip?.id) {
            try {
                const saved = localStorage.getItem("activeTrip");
                if (saved) {
                    currentTrip = JSON.parse(saved);
                }
            } catch {
                // ignore
            }
        }

        if (!currentTrip || !currentTrip.id || isStoppingTrip) {
            if (!currentTrip || !currentTrip.id) setMessage("No active trip found.");
            return;
        }

        setIsStoppingTrip(true);
        try {
            await api.post(`/Trips/stop/${currentTrip.id}`);

            // Stop GPS tracking
            stopLocationTracking();

            // Immediately stop repeating alarm and clear all intervals and timeouts
            stopAlarmLoop();

            // Remove saved trip from localStorage
            localStorage.removeItem("activeTrip");

            setMessage("Trip stopped successfully! 🛑");

            setTrip(null);
            setLocation(null);
            setResult(null);
            latestLocationRef.current = null;
            setDestinationName("");
            if (audioContextRef.current && audioContextRef.current.state !== "closed") {
                try {
                    audioContextRef.current.close();
                } catch {
                    // ignore
                }
                audioContextRef.current = null;
            }
        } catch (error) {
            console.error("Stop trip error:", error);
            const errMsg = getApiErrorMessage(error, "Unable to stop trip.");
            setMessage(errMsg);
            if (error.response?.status === 401) {
                stopLocationTracking();
                localStorage.removeItem("token");
                setTimeout(() => navigate("/login", { state: { message: errMsg } }), 1200);
            }
        } finally {
            setIsStoppingTrip(false);
        }
    };

    // Helper: Safely resolve Destination display name (never raw GUID)
    const getDestinationName = (tripData) => {
        if (!tripData) return "Destination";
        if (destinationName && !isRawGuid(destinationName)) {
            return destinationName;
        }
        if (
            tripData.destination &&
            typeof tripData.destination === "object" &&
            tripData.destination.name &&
            !isRawGuid(tripData.destination.name)
        ) {
            return tripData.destination.name;
        }
        if (
            typeof tripData.destination === "string" &&
            tripData.destination.trim() &&
            !isRawGuid(tripData.destination)
        ) {
            return tripData.destination;
        }
        if (tripData.destinationName && !isRawGuid(tripData.destinationName)) {
            return tripData.destinationName;
        }
        if (isLoadingDestination) {
            return "Loading destination...";
        }
        return "Destination";
    };

    // Helper: Format Started At timestamp cleanly (e.g. 12:16 PM, 24 Sept 2026)
    const formatStartedAt = (dateStr) => {
        if (!dateStr) return "N/A";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const time = date.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                hour12: true
            });
            const day = date.getDate();
            const monthNames = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"
            ];
            const month = monthNames[date.getMonth()];
            const year = date.getFullYear();
            return `${time}, ${day} ${month} ${year}`;
        } catch {
            return dateStr;
        }
    };

    // Helper: Categorize message for visual error/status styling
    const getMessageCategory = (msg) => {
        if (!msg) return null;
        const lower = msg.toLowerCase();
        if (lower.includes("session expired")) return "session-error";
        if (
            lower.includes("allow location") ||
            lower.includes("not supported") ||
            lower.includes("unable to get your location")
        )
            return "gps-error";
        if (lower.includes("unable")) return "api-error";
        if (lower.includes("🚨") || lower.includes("reached the alert distance"))
            return "alert-triggered";
        if (
            lower.includes("successfully") ||
            lower.includes("updated automatically")
        )
            return "success";
        return "info";
    };

    const isTriggered =
        Boolean(result?.triggered ?? result?.Triggered) ||
        message.includes("🚨") ||
        message.includes("reached the alert distance");

    const messageCategory = getMessageCategory(message);

    // Empty state: No active trip
    if (!trip) {
        return (
            <div className="active-trip-container">
                <Navbar />

                <div className="active-trip-empty-wrapper">
                    <div className="empty-state-card">
                        <div className="empty-state-icon" aria-hidden="true">🧭</div>
                        <h1 className="empty-state-title">Active Trip</h1>
                        <p className="empty-state-desc">
                            {message ||
                                "No active trip found. Start a new trip from the destination list to begin live proximity monitoring."}
                        </p>
                        <div className="empty-state-actions">
                            <Link to="/start-trip" className="empty-btn-primary">
                                <span aria-hidden="true">🚀</span> Start a New Trip
                            </Link>
                            <Link to="/dashboard" className="empty-btn-secondary">
                                <span aria-hidden="true">📋</span> Go to Dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="active-trip-container">
            {/* Unified Application Navigation */}
            <Navbar />

            {/* Page Header */}
            <header className="active-trip-header">
                <div className="active-trip-title-group">
                    <div className="active-trip-title-wrap">
                        <span className="active-trip-logo-icon" aria-hidden="true">🚗</span>
                        <h1 className="active-trip-title">Active Trip</h1>
                    </div>
                    <p className="active-trip-subtitle">
                        Your journey is being monitored automatically in real time.
                    </p>
                </div>
            </header>

            {/* Prominent Alert State Banner when Triggered */}
            {isTriggered && (
                <section
                    className="alarm-triggered-banner"
                    role="alert"
                    aria-live="assertive"
                >
                    <div className="alarm-icon-wrap" aria-hidden="true">
                        🚨
                    </div>
                    <div className="alarm-text-wrap">
                        <span className="alarm-tag">DESTINATION ALERT</span>
                        <h2 className="alarm-headline">
                            Alert Triggered! You have reached the alert distance!
                        </h2>
                        <div className="alarm-sub-status">
                            <span className="alarm-status-pill">
                                <span className="status-dot red-dot" aria-hidden="true"></span>
                                🔔 Alarm Repeating
                            </span>
                            <span className="alarm-details-text">
                                You are within {trip.alertDistanceKm} km of{" "}
                                <strong>{getDestinationName(trip)}</strong>.
                            </span>
                        </div>
                    </div>
                </section>
            )}

            {/* Audio Autoplay Blocked Notice */}
            {audioBlocked && (
                <div
                    className="trip-notice-banner notice-audio-prompt"
                    role="alert"
                    onClick={handleEnableAudio}
                    style={{ cursor: "pointer", marginTop: isTriggered ? "12px" : "0" }}
                >
                    <span className="notice-icon" aria-hidden="true">🔔</span>
                    <div className="notice-body">
                        <div>
                            <strong className="notice-title">Audio Notice:</strong>
                            <span>Tap the page once to enable the alarm.</span>
                        </div>
                        <button
                            type="button"
                            className="notice-link-btn"
                            onClick={handleEnableAudio}
                        >
                            Tap to enable alarm
                        </button>
                    </div>
                </div>
            )}

            {/* Status & Error Notice Banners */}
            {message && !isTriggered && (
                <div
                    className={`trip-notice-banner notice-${messageCategory}`}
                    role={messageCategory?.includes("error") ? "alert" : "status"}
                >
                    <span className="notice-icon" aria-hidden="true">
                        {messageCategory === "session-error" && "🔒"}
                        {messageCategory === "gps-error" && "🛰️"}
                        {messageCategory === "api-error" && "⚠️"}
                        {messageCategory === "success" && "✅"}
                        {messageCategory === "info" && "ℹ️"}
                    </span>
                    <div className="notice-body">
                        <div>
                            {messageCategory === "session-error" && (
                                <strong className="notice-title">
                                    Authentication Error:
                                </strong>
                            )}
                            {messageCategory === "gps-error" && (
                                <strong className="notice-title">
                                    GPS Notice:
                                </strong>
                            )}
                            {messageCategory === "api-error" && (
                                <strong className="notice-title">
                                    Update Notice:
                                </strong>
                            )}
                            <span>{message}</span>
                        </div>
                        {messageCategory === "session-error" && (
                            <Link to="/login" className="notice-link-btn">
                                Log In Again
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* Prominent "Trip Status" Section */}
            <section className="dashboard-card trip-status-card" aria-label="Trip Status Section">
                <div className="card-header-row">
                    <div className="card-title-group">
                        <span className="card-icon" aria-hidden="true">🧭</span>
                        <h2 className="card-heading">Trip Status</h2>
                    </div>

                    <div className="trip-status-badges-group">
                        {/* Active Trip Badge */}
                        <div className="status-pill status-pill-active">
                            <span className="pulse-dot green" aria-hidden="true"></span>
                            <span className="status-pill-text">Active</span>
                        </div>

                        {/* GPS Tracking Status */}
                        {trackingActive ? (
                            <div className="status-pill status-pill-tracking">
                                <span className="pulse-dot green" aria-hidden="true"></span>
                                <span className="status-pill-text">Tracking Active</span>
                            </div>
                        ) : (
                            <div className="status-pill status-pill-stopped">
                                <span className="status-dot red-dot" aria-hidden="true"></span>
                                <span className="status-pill-text">Tracking Stopped</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="trip-status-sub-banner">
                    <div className="destination-hero-group">
                        <span className="destination-hero-label">Target Destination</span>
                        <h3 className="destination-name">
                            <span className="destination-pin-icon" aria-hidden="true">📍</span>
                            <span>{getDestinationName(trip)}</span>
                        </h3>
                    </div>
                    <div className="tracking-status-desc-wrap">
                        <span className="tracking-status-mode-label">Tracking Mode</span>
                        <p className="tracking-status-desc">
                            {trackingActive
                                ? "Automatic GPS tracking active. Your location is being monitored automatically."
                                : "Location tracking is currently stopped."}
                        </p>
                    </div>
                </div>

                {/* Key Trip Metrics */}
                <div className="trip-summary-metrics-grid">
                    <div className="summary-metric-card">
                        <div className="metric-header">
                            <span className="metric-icon" aria-hidden="true">📍</span>
                            <span className="metric-label">Destination</span>
                        </div>
                        <div className="metric-value destination-metric-val">
                            {getDestinationName(trip)}
                        </div>
                    </div>

                    <div className="summary-metric-card">
                        <div className="metric-header">
                            <span className="metric-icon" aria-hidden="true">🔔</span>
                            <span className="metric-label">Alert Distance Threshold</span>
                        </div>
                        <div className="metric-value">
                            <span>{trip.alertDistanceKm}</span>
                            <span className="metric-unit">km</span>
                        </div>
                    </div>

                    <div className="summary-metric-card">
                        <div className="metric-header">
                            <span className="metric-icon" aria-hidden="true">🕐</span>
                            <span className="metric-label">Started At</span>
                        </div>
                        <div className="metric-value metric-timestamp">
                            {formatStartedAt(trip.startedAt)}
                        </div>
                    </div>
                </div>
            </section>

            {/* Grid: Distance to Destination & Alert Status */}
            <div className="trip-dashboard-grid">
                {/* Prominent Distance to Destination Section */}
                <section
                    className="dashboard-card distance-card"
                    aria-label="Distance to Destination Section"
                >
                    <div className="card-header-row">
                        <div className="card-title-group">
                            <span className="card-icon" aria-hidden="true">📏</span>
                            <h3 className="card-heading">Distance to destination</h3>
                        </div>
                        {result && (result.distanceKm != null || result.DistanceKm != null) && (
                            <span className="badge-tag-subtle">Live Backend Distance</span>
                        )}
                    </div>

                    {result && (result.distanceKm != null || result.DistanceKm != null) ? (
                        <div className="distance-hero-container">
                            <div className="distance-hero-val">
                                <span className="distance-number">
                                    {result.distanceKm ?? result.DistanceKm}
                                </span>
                                <span className="distance-unit">km</span>
                            </div>
                            <p className="distance-hero-caption">
                                Calculated from current GPS
                            </p>
                        </div>
                    ) : (
                        <div className="distance-empty-state">
                            <span className="distance-empty-icon" aria-hidden="true">🛰️</span>
                            <p className="distance-empty-text">Waiting for GPS update...</p>
                            <p className="distance-empty-subtext">
                                Distance will appear automatically once location is received.
                            </p>
                        </div>
                    )}
                </section>

                {/* Prominent Alert Status Section */}
                <section
                    className={`dashboard-card alert-status-card ${
                        (result?.triggered ?? result?.Triggered) ? "is-triggered" : "is-monitoring"
                    }`}
                    aria-label="Alert Status Section"
                >
                    <div className="card-header-row">
                        <div className="card-title-group">
                            <span className="card-icon" aria-hidden="true">
                                {(result?.triggered ?? result?.Triggered) ? "🚨" : "🔔"}
                            </span>
                            <h3 className="card-heading">Alert Status</h3>
                        </div>
                        {(result?.triggered ?? result?.Triggered) ? (
                            <span className="alert-header-badge alert-badge-danger">
                                <span className="pulse-dot red" aria-hidden="true"></span>
                                Alert Triggered
                            </span>
                        ) : (
                            <span className="alert-header-badge alert-badge-monitoring">
                                <span className="pulse-dot green" aria-hidden="true"></span>
                                Monitoring
                            </span>
                        )}
                    </div>

                    <div className="alert-status-body">
                        {(result?.triggered ?? result?.Triggered) ? (
                            <div className="alert-status-state-box triggered">
                                <div className="alert-status-lead">
                                    <span className="status-dot red-dot" aria-hidden="true"></span>
                                    <span className="alert-status-headline">Alert Triggered</span>
                                </div>
                                <p className="alert-status-subtext">
                                    You have reached the alert distance!
                                </p>
                            </div>
                        ) : (
                            <div className="alert-status-state-box monitoring">
                                <div className="alert-status-lead">
                                    <span className="status-dot green-dot" aria-hidden="true"></span>
                                    <span className="alert-status-headline">Waiting for alert distance</span>
                                </div>
                                <p className="alert-status-subtext">
                                    Alert will trigger when you reach the selected distance ({trip.alertDistanceKm} km).
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Current Location Section */}
            <section
                className="dashboard-card location-card"
                aria-label="Current Location Section"
            >
                <div className="card-header-row">
                    <div className="card-title-group">
                        <span className="card-icon" aria-hidden="true">📍</span>
                        <h3 className="card-heading">Current Location</h3>
                    </div>
                    <div className="gps-state-wrap">
                        {location ? (
                            <span className="gps-state-badge state-active">
                                <span className="status-dot green-dot" aria-hidden="true"></span>
                                🟢 GPS tracking active
                            </span>
                        ) : (
                            <span className="gps-state-badge state-waiting">
                                <span className="gps-wait-icon" aria-hidden="true">📡</span>
                                Waiting for GPS location...
                            </span>
                        )}
                    </div>
                </div>

                {location ? (
                    <div className="location-coords-grid">
                        <div className="coord-cell">
                            <span className="coord-label">Latitude</span>
                            <span className="coord-number">
                                {typeof location.latitude === "number"
                                    ? location.latitude.toFixed(6)
                                    : location.latitude}
                            </span>
                        </div>
                        <div className="coord-cell">
                            <span className="coord-label">Longitude</span>
                            <span className="coord-number">
                                {typeof location.longitude === "number"
                                    ? location.longitude.toFixed(6)
                                    : location.longitude}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="location-empty-state">
                        <span className="location-empty-icon" aria-hidden="true">📡</span>
                        <p className="location-empty-text">Waiting for GPS location...</p>
                        <p className="location-empty-subtext">
                            Acquiring coordinates from your device's geolocation sensor.
                        </p>
                    </div>
                )}
            </section>

            {/* Actions: Check Location Now & Stop Trip */}
            <section className="active-trip-actions-wrapper" aria-label="Trip Control Actions">
                <div className="actions-header-wrap">
                    <h3 className="actions-heading">Trip Controls</h3>
                    <p className="actions-subtext">
                        Perform an immediate location refresh or terminate this active trip.
                    </p>
                </div>

                <div className="active-trip-actions">
                    <button
                        type="button"
                        id="btn-check-location"
                        className="btn-trip-action btn-check-location"
                        onClick={getLocationNow}
                        disabled={isCheckingLocation || isStoppingTrip}
                        aria-busy={isCheckingLocation}
                    >
                        {isCheckingLocation ? (
                            <>
                                <span className="spinner-dot" aria-hidden="true"></span>
                                <span>Getting current location...</span>
                            </>
                        ) : (
                            <>
                                <span aria-hidden="true">📍</span>
                                <span>Check Location Now</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        id="btn-stop-trip"
                        className="btn-trip-action btn-stop-trip"
                        onClick={stopTrip}
                        disabled={isStoppingTrip || isCheckingLocation}
                        aria-busy={isStoppingTrip}
                    >
                        {isStoppingTrip ? (
                            <>
                                <span className="spinner-dot" aria-hidden="true"></span>
                                <span>Stopping trip...</span>
                            </>
                        ) : (
                            <>
                                <span aria-hidden="true">🛑</span>
                                <span>Stop Trip</span>
                            </>
                        )}
                    </button>
                </div>
            </section>
        </div>
    );
}

export default ActiveTrip;