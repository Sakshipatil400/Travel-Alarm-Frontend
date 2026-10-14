import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { getApiErrorMessage } from "../utils/errorHandler";
import Navbar from "../components/Navbar";
import "./StartTrip.css";

function StartTrip() {
    const [destinations, setDestinations] = useState([]);
    const [destinationId, setDestinationId] = useState("");
    const [alertDistanceKm, setAlertDistanceKm] = useState(5);
    const [message, setMessage] = useState("");
    const [trip, setTrip] = useState(null);
    const [isLoadingDestinations, setIsLoadingDestinations] = useState(true);
    const [destinationsError, setDestinationsError] = useState(null);
    const [isStarting, setIsStarting] = useState(false);

    const navigate = useNavigate();

    // Manual trigger for retry
    const fetchDestinations = async () => {
        setIsLoadingDestinations(true);
        setDestinationsError(null);

        try {
            const response = await api.get("/Destinations");
            console.log("Destinations:", response.data);

            const raw = response.data;
            const list = Array.isArray(raw)
                ? raw
                : Array.isArray(raw?.$values)
                ? raw.$values
                : Array.isArray(raw?.data)
                ? raw.data
                : [];

            setDestinations(list);
        } catch (error) {
            console.error("Destination error:", error);
            const errMsg = getApiErrorMessage(error, "We couldn't load your destinations. Please try again.");
            setDestinationsError(errMsg);
            if (error.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("activeTrip");
                navigate("/login", { state: { message: errMsg } });
            }
        } finally {
            setIsLoadingDestinations(false);
        }
    };

    // Initial load on mount
    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                const response = await api.get("/Destinations");
                console.log("Destinations:", response.data);

                if (!isMounted) return;

                const raw = response.data;
                const list = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.$values)
                    ? raw.$values
                    : Array.isArray(raw?.data)
                    ? raw.data
                    : [];

                setDestinations(list);
            } catch (error) {
                console.error("Destination error:", error);
                if (isMounted) {
                    const errMsg = getApiErrorMessage(error, "We couldn't load your destinations. Please try again.");
                    setDestinationsError(errMsg);
                    if (error.response?.status === 401) {
                        localStorage.removeItem("token");
                        localStorage.removeItem("activeTrip");
                        navigate("/login", { state: { message: errMsg } });
                    }
                }
            } finally {
                if (isMounted) {
                    setIsLoadingDestinations(false);
                }
            }
        };

        load();

        return () => {
            isMounted = false;
        };
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 4. Destination validation
        if (!destinationId) {
            setMessage("Please select a destination.");
            return;
        }

        // 8. Alert distance validation
        const dist = Number(alertDistanceKm);
        if (isNaN(dist) || alertDistanceKm === "" || alertDistanceKm === null) {
            setMessage("Please enter a valid alert distance number.");
            return;
        }
        if (dist <= 0) {
            setMessage("Alert distance must be greater than 0 km.");
            return;
        }

        try {
            setIsStarting(true);
            setMessage("Starting trip...");

            const response = await api.post("/Trips/start", {
                destinationId: destinationId,
                alertDistanceKm: Number(alertDistanceKm)
            });

            console.log("Trip started:", response.data);

            // Store the newly created trip
            localStorage.setItem(
                "activeTrip",
                JSON.stringify(response.data)
            );

            // Show trip on this page
            setTrip(response.data);

            setMessage("Trip started successfully!");

            // Go to Active Trip page
            navigate("/active-trip");

        } catch (error) {
            console.error("Start trip error:", error);
            const errMsg = getApiErrorMessage(error, "Something went wrong while starting your trip. Please try again.");
            setMessage(errMsg);
            if (error.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("activeTrip");
                setTimeout(() => navigate("/login", { state: { message: errMsg } }), 1200);
            }
        } finally {
            setIsStarting(false);
        }
    };

    // Helper: Find selected destination object for Trip Summary
    const selectedDestination = destinations.find(
        (dest) => String(dest.id) === String(destinationId)
    );

    // Helper: Categorize message for visual styling
    const getNoticeCategory = (msg) => {
        if (!msg) return "";
        const lower = msg.toLowerCase();
        if (lower.includes("successfully")) return "notice-success";
        if (lower.includes("starting")) return "notice-info";
        if (
            lower.includes("unable") ||
            lower.includes("expired") ||
            lower.includes("please select")
        ) {
            return "notice-error";
        }
        return "notice-info";
    };

    return (
        <div className="start-trip-container">
            {/* Unified Application Navigation */}
            <Navbar />

            {/* Page Header */}
            <header className="start-trip-header">
                <div className="start-trip-title-group">
                    <div className="start-trip-title-wrap">
                        <span className="start-trip-logo-icon" aria-hidden="true">🧭</span>
                        <h1 className="start-trip-title">Start a New Trip</h1>
                    </div>
                    <p className="start-trip-subtitle">
                        Choose your destination and set when you want to be alerted.
                    </p>
                </div>
            </header>

            {/* Status / Message Banner */}
            {message && (
                <div
                    className={`start-trip-notice-banner ${getNoticeCategory(message)}`}
                    role="alert"
                >
                    <div className="notice-icon-box" aria-hidden="true">
                        {isStarting && message.includes("Starting") ? (
                            <span className="spinner-inline"></span>
                        ) : message.includes("successfully") ? (
                            "✓"
                        ) : message.includes("select a destination") ? (
                            "📍"
                        ) : message.includes("expired") ? (
                            "🔒"
                        ) : (
                            "⚠️"
                        )}
                    </div>
                    <div className="notice-content">
                        <div className="notice-text-wrap">
                            {message.includes("Something went wrong") && (
                                <strong className="notice-headline">Unable to Start Trip: </strong>
                            )}
                            <span className="notice-main-text">{message}</span>
                        </div>
                        {message.includes("Session expired") && (
                            <Link to="/login" className="notice-action-link">
                                Log in
                            </Link>
                        )}
                    </div>
                    {!isStarting && (
                        <button
                            type="button"
                            className="notice-dismiss-btn"
                            onClick={() => setMessage("")}
                            aria-label="Dismiss message"
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}

            {/* Main Card */}
            <main className="start-trip-card">
                <div className="start-card-header">
                    <div className="start-card-title-row">
                        <span className="start-card-icon" aria-hidden="true">🚗</span>
                        <h2 className="start-card-title">Start Your Trip</h2>
                    </div>
                    <p className="start-card-desc">
                        Select your destination and choose how far away you want to be alerted.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="start-trip-form">
                    {/* Destination Selection */}
                    <div className="form-group">
                        <label htmlFor="destination-select" className="form-label">
                            <span className="label-icon" aria-hidden="true">📍</span> Destination
                        </label>

                        {/* 3. Destination API Error */}
                        {destinationsError ? (
                            <div className="destinations-error-box" role="alert">
                                <div className="destinations-error-content">
                                    <span className="destinations-error-icon" aria-hidden="true">⚠️</span>
                                    <div className="destinations-error-text">
                                        <strong className="destinations-error-title">Unable to Load Destinations</strong>
                                        <p className="destinations-error-desc">{destinationsError}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={fetchDestinations}
                                    className="btn-retry-destinations"
                                    disabled={isLoadingDestinations}
                                >
                                    <span aria-hidden="true">🔄</span>
                                    <span>Try Again</span>
                                </button>
                            </div>
                        ) : isLoadingDestinations ? (
                            /* 1. Destination Loading State */
                            <div className="select-loading-box" role="status" aria-live="polite">
                                <span className="spinner-inline" aria-hidden="true"></span>
                                <span>Loading destinations...</span>
                            </div>
                        ) : destinations.length > 0 ? (
                            <div className="custom-select-wrapper">
                                <select
                                    id="destination-select"
                                    className="form-select"
                                    value={destinationId}
                                    disabled={isStarting}
                                    onChange={(e) => {
                                        setDestinationId(e.target.value);
                                        if (message && message.includes("Please select")) {
                                            setMessage("");
                                        }
                                    }}
                                >
                                    <option value="">
                                        📍 Select Destination
                                    </option>
                                    {destinations.map((destination) => (
                                        <option
                                            key={destination.id}
                                            value={destination.id}
                                        >
                                            📍 {destination.name}
                                        </option>
                                    ))}
                                </select>
                                <span className="select-arrow" aria-hidden="true">▼</span>
                            </div>
                        ) : (
                            /* 2. Destination Empty State */
                            <div className="destinations-empty-state">
                                <div className="destinations-empty-icon" aria-hidden="true">📍</div>
                                <div className="destinations-empty-info">
                                    <strong className="destinations-empty-title">No Destinations Available</strong>
                                    <p className="destinations-empty-desc">
                                        You need to add a destination before starting a trip.
                                    </p>
                                </div>
                                <Link to="/destinations" className="btn-add-dest-link">
                                    <span>Add Destination</span>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Alert Distance Selection */}
                    <div className="form-group">
                        <label htmlFor="alert-distance-input" className="form-label">
                            <span className="label-icon" aria-hidden="true">🔔</span> Alert Distance
                        </label>

                        <p className="form-hint">
                            You will receive an alert when you are within this distance of your destination.
                        </p>

                        <div className="input-with-suffix">
                            <input
                                id="alert-distance-input"
                                className="form-input"
                                type="number"
                                min="0.1"
                                step="any"
                                value={alertDistanceKm}
                                disabled={isStarting}
                                onChange={(e) => {
                                    setAlertDistanceKm(e.target.value);
                                    if (message && (message.includes("distance") || message.includes("valid"))) {
                                        setMessage("");
                                    }
                                }}
                                required
                            />
                            <span className="input-suffix">km</span>
                        </div>

                        {/* Presets for convenient UX */}
                        <div className="distance-presets" aria-label="Quick distance presets">
                            <span className="preset-chip-label">Quick select:</span>
                            {[1, 2, 5, 10, 15].map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    className={`preset-btn ${
                                        Number(alertDistanceKm) === preset
                                            ? "preset-btn-active"
                                             : ""
                                    }`}
                                    disabled={isStarting}
                                    onClick={() => setAlertDistanceKm(preset)}
                                >
                                    {preset} km
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Trip Summary Card (Shown when a destination is selected) */}
                    {destinationId && (
                        <div className="trip-summary-card">
                            <div className="trip-summary-header">
                                <span className="summary-badge-icon" aria-hidden="true">📋</span>
                                <h3 className="trip-summary-title">Trip Summary</h3>
                            </div>
                            <div className="trip-summary-grid">
                                <div className="summary-item">
                                    <span className="summary-label">
                                        <span aria-hidden="true">📍</span> Destination:
                                    </span>
                                    <span className="summary-value">
                                        {selectedDestination ? selectedDestination.name : "Selected"}
                                    </span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-label">
                                        <span aria-hidden="true">🔔</span> Alert Distance:
                                    </span>
                                    <span className="summary-value">
                                        {alertDistanceKm ? `${alertDistanceKm} km` : "5 km"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. Submit Button with Starting Loading State */}
                    <button
                        type="submit"
                        className="btn-start-trip"
                        disabled={
                            isStarting ||
                            isLoadingDestinations ||
                            Boolean(destinationsError) ||
                            destinations.length === 0
                        }
                    >
                        {isStarting ? (
                            <>
                                <span className="btn-spinner" aria-hidden="true"></span>
                                <span>⏳ Starting Trip...</span>
                            </>
                        ) : (
                            <>
                                <span className="btn-icon" aria-hidden="true">🚗</span>
                                <span>Start Trip</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Preserved Trip state display */}
                {trip && (
                    <div className="trip-started-card">
                        <h3 className="trip-started-title">
                            <span>✓</span> Trip Started
                        </h3>
                        <div className="trip-started-details">
                            <p><strong>Trip ID:</strong> {trip.id}</p>
                            <p><strong>Alert Distance:</strong> {trip.alertDistanceKm} km</p>
                            <p><strong>Started At:</strong> {trip.startedAt}</p>
                        </div>
                    </div>
                )}
            </main>

            {/* How It Works Section */}
            <aside className="how-it-works-card" aria-label="How it works">
                <div className="how-it-works-header">
                    <span className="summary-badge-icon" aria-hidden="true">💡</span>
                    <h3 className="how-it-works-title">How it works</h3>
                </div>
                <ol className="how-it-works-list">
                    <li className="how-it-works-item">
                        <span className="step-number" aria-hidden="true">1</span>
                        <span className="step-text">Choose your destination</span>
                    </li>
                    <li className="how-it-works-item">
                        <span className="step-number" aria-hidden="true">2</span>
                        <span className="step-text">Set your alert distance</span>
                    </li>
                    <li className="how-it-works-item">
                        <span className="step-number" aria-hidden="true">3</span>
                        <span className="step-text">Start your trip</span>
                    </li>
                    <li className="how-it-works-item">
                        <span className="step-number" aria-hidden="true">4</span>
                        <span className="step-text">Your location is monitored automatically</span>
                    </li>
                    <li className="how-it-works-item">
                        <span className="step-number" aria-hidden="true">5</span>
                        <span className="step-text">Get an alert when you reach the selected distance</span>
                    </li>
                </ol>
            </aside>
        </div>
    );
}

export default StartTrip;