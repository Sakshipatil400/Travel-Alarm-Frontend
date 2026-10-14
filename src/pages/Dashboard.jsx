import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { getApiErrorMessage } from "../utils/errorHandler";
import Navbar from "../components/Navbar";
import "./Dashboard.css";

function Dashboard() {
    const navigate = useNavigate();

    const [destinations, setDestinations] = useState([]);
    const [trips, setTrips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState("");

    // 1. Read active trip from localStorage
    const [activeTrip, setActiveTrip] = useState(() => {
        try {
            const saved = localStorage.getItem("activeTrip");
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    // Sync activeTrip on storage changes across tabs
    useEffect(() => {
        const handleSync = (e) => {
            if (e.key === "activeTrip") {
                try {
                    const saved = localStorage.getItem("activeTrip");
                    setActiveTrip(saved ? JSON.parse(saved) : null);
                } catch {
                    setActiveTrip(null);
                }
            }
        };

        window.addEventListener("storage", handleSync);

        return () => {
            window.removeEventListener("storage", handleSync);
        };
    }, []);

    // 2. Initial Fetch Destinations & Trips
    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                const [destsRes, tripsRes] = await Promise.allSettled([
                    api.get("/Destinations"),
                    api.get("/Trips")
                ]);

                if (!isMounted) return;

                let hasError = false;
                let errMsg = "";

                // Parse Destinations
                if (destsRes.status === "fulfilled") {
                    const rawDests = destsRes.value?.data;
                    const destList = Array.isArray(rawDests)
                        ? rawDests
                        : rawDests?.$values || rawDests?.data || [];
                    setDestinations(destList);
                } else {
                    console.error("Dashboard error loading destinations:", destsRes.reason);
                    if (destsRes.reason?.response?.status === 401) {
                        const authMsg = "Session expired. Please login again.";
                        setMessage(authMsg);
                        localStorage.removeItem("token");
                        localStorage.removeItem("activeTrip");
                        navigate("/login", { state: { message: authMsg } });
                        return;
                    }
                    hasError = true;
                    errMsg = getApiErrorMessage(destsRes.reason, "Unable to load destinations.");
                }

                // Parse Trips
                if (tripsRes.status === "fulfilled") {
                    const rawTrips = tripsRes.value?.data;
                    const tripsList = Array.isArray(rawTrips)
                        ? rawTrips
                        : rawTrips?.$values || rawTrips?.data || [];
                    setTrips(tripsList);

                    // Derive active trip from backend response as source of truth
                    const activeList = tripsList.filter(
                        (t) =>
                            !t.endedAt &&
                            !t.EndedAt &&
                            t.status?.toLowerCase() !== "completed" &&
                            t.status?.toLowerCase() !== "stopped" &&
                            t.status?.toLowerCase() !== "ended" &&
                            t.status?.toLowerCase() !== "cancelled"
                    );

                    if (activeList.length > 0) {
                        activeList.sort(
                            (a, b) =>
                                new Date(b.startedAt || b.StartedAt || 0) -
                                new Date(a.startedAt || a.StartedAt || 0)
                        );
                        const foundActive = activeList[0];
                        const normalizedActive = {
                            ...foundActive,
                            id: foundActive.id || foundActive.Id,
                            destinationId: foundActive.destinationId || foundActive.DestinationId,
                            alertDistanceKm: foundActive.alertDistanceKm ?? foundActive.AlertDistanceKm,
                            startedAt: foundActive.startedAt || foundActive.StartedAt,
                            endedAt: foundActive.endedAt || foundActive.EndedAt || null,
                            destinationName: foundActive.destinationName || foundActive.DestinationName,
                            destination: foundActive.destination || foundActive.Destination,
                            status: foundActive.status || foundActive.Status || "Active",
                            alertTriggered: Boolean(
                                foundActive.alertTriggered ?? foundActive.AlertTriggered
                            )
                        };
                        setActiveTrip(normalizedActive);
                        try {
                            localStorage.setItem("activeTrip", JSON.stringify(normalizedActive));
                        } catch {
                            // ignore
                        }
                    } else {
                        setActiveTrip(null);
                        try {
                            localStorage.removeItem("activeTrip");
                        } catch {
                            // ignore
                        }
                    }
                } else {
                    console.error("Dashboard error loading trips:", tripsRes.reason);
                    if (tripsRes.reason?.response?.status === 401) {
                        const authMsg = "Session expired. Please login again.";
                        setMessage(authMsg);
                        localStorage.removeItem("token");
                        localStorage.removeItem("activeTrip");
                        navigate("/login", { state: { message: authMsg } });
                        return;
                    }
                    hasError = true;
                    const tripErrMsg = getApiErrorMessage(tripsRes.reason, "Unable to load trips.");
                    errMsg = errMsg ? errMsg : tripErrMsg;
                }

                if (hasError) {
                    setMessage(errMsg);
                }
            } catch (error) {
                console.error("Dashboard error:", error);
                if (isMounted) {
                    const errText = getApiErrorMessage(error, "Failed to load dashboard data.");
                    setMessage(errText);
                    if (error?.response?.status === 401) {
                        localStorage.removeItem("token");
                        localStorage.removeItem("activeTrip");
                        navigate("/login", { state: { message: errText } });
                    }
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        load();

        return () => {
            isMounted = false;
        };
    }, [navigate]);

    // Manual refresh / retry handler
    const handleRetry = useCallback(async () => {
        setIsLoading(true);
        setMessage("");

        try {
            const [destsRes, tripsRes] = await Promise.allSettled([
                api.get("/Destinations"),
                api.get("/Trips")
            ]);

            let hasError = false;
            let errMsg = "";

            if (destsRes.status === "fulfilled") {
                const rawDests = destsRes.value?.data;
                const destList = Array.isArray(rawDests)
                    ? rawDests
                    : rawDests?.$values || rawDests?.data || [];
                setDestinations(destList);
            } else {
                if (destsRes.reason?.response?.status === 401) {
                    const authMsg = "Session expired. Please login again.";
                    setMessage(authMsg);
                    localStorage.removeItem("token");
                    localStorage.removeItem("activeTrip");
                    navigate("/login", { state: { message: authMsg } });
                    return;
                }
                hasError = true;
                errMsg = getApiErrorMessage(destsRes.reason, "Unable to load destinations.");
            }

            if (tripsRes.status === "fulfilled") {
                const rawTrips = tripsRes.value?.data;
                const tripsList = Array.isArray(rawTrips)
                    ? rawTrips
                    : rawTrips?.$values || rawTrips?.data || [];
                setTrips(tripsList);

                // Derive active trip from backend response as source of truth
                const activeList = tripsList.filter(
                    (t) =>
                        !t.endedAt &&
                        !t.EndedAt &&
                        t.status?.toLowerCase() !== "completed" &&
                        t.status?.toLowerCase() !== "stopped" &&
                        t.status?.toLowerCase() !== "ended" &&
                        t.status?.toLowerCase() !== "cancelled"
                );

                if (activeList.length > 0) {
                    activeList.sort(
                        (a, b) =>
                            new Date(b.startedAt || b.StartedAt || 0) -
                            new Date(a.startedAt || a.StartedAt || 0)
                    );
                    const foundActive = activeList[0];
                    const normalizedActive = {
                        ...foundActive,
                        id: foundActive.id || foundActive.Id,
                        destinationId: foundActive.destinationId || foundActive.DestinationId,
                        alertDistanceKm: foundActive.alertDistanceKm ?? foundActive.AlertDistanceKm,
                        startedAt: foundActive.startedAt || foundActive.StartedAt,
                        endedAt: foundActive.endedAt || foundActive.EndedAt || null,
                        destinationName: foundActive.destinationName || foundActive.DestinationName,
                        destination: foundActive.destination || foundActive.Destination,
                        status: foundActive.status || foundActive.Status || "Active",
                        alertTriggered: Boolean(
                            foundActive.alertTriggered ?? foundActive.AlertTriggered
                        )
                    };
                    setActiveTrip(normalizedActive);
                    try {
                        localStorage.setItem("activeTrip", JSON.stringify(normalizedActive));
                    } catch {
                        // ignore
                    }
                } else {
                    setActiveTrip(null);
                    try {
                        localStorage.removeItem("activeTrip");
                    } catch {
                        // ignore
                    }
                }
            } else {
                if (tripsRes.reason?.response?.status === 401) {
                    const authMsg = "Session expired. Please login again.";
                    setMessage(authMsg);
                    localStorage.removeItem("token");
                    localStorage.removeItem("activeTrip");
                    navigate("/login", { state: { message: authMsg } });
                    return;
                }
                hasError = true;
                const tripErrMsg = getApiErrorMessage(tripsRes.reason, "Unable to load trips.");
                errMsg = errMsg ? errMsg : tripErrMsg;
            }

            if (hasError) {
                setMessage(errMsg);
            }
        } catch (error) {
            console.error("Dashboard retry error:", error);
            const errText = getApiErrorMessage(error, "Failed to load dashboard data.");
            setMessage(errText);
            if (error?.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("activeTrip");
                navigate("/login", { state: { message: errText } });
            }
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    // Map destinations for quick name resolution
    const destinationsMap = destinations.reduce((acc, d) => {
        if (d?.id && d?.name) {
            acc[d.id] = d.name;
            acc[String(d.id).toLowerCase()] = d.name;
        }
        return acc;
    }, {});

    // Summary counts calculated from API responses
    const totalDestinations = destinations.length;
    const totalTrips = trips.length;
    const completedTrips = trips.filter(
        (t) => Boolean(t.endedAt) || t.status?.toLowerCase() === "completed"
    ).length;
    const activeTrips = trips.filter(
        (t) => !t.endedAt && t.status?.toLowerCase() !== "completed"
    ).length;

    // Helper: Safely resolve Destination display name for active trip
    const getActiveTripDestination = (tripData) => {
        if (!tripData) return "Destination";
        if (tripData.destinationName) {
            return tripData.destinationName;
        }
        if (
            tripData.destination &&
            typeof tripData.destination === "object" &&
            tripData.destination.name
        ) {
            return tripData.destination.name;
        }
        if (typeof tripData.destination === "string" && tripData.destination.trim()) {
            return tripData.destination;
        }
        if (tripData.destinationId) {
            if (destinationsMap[tripData.destinationId]) {
                return destinationsMap[tripData.destinationId];
            }
            return `Destination #${String(tripData.destinationId).slice(0, 8)}...`;
        }
        return "Destination";
    };

    // Helper: Cleanly format timestamp
    const formatDateTime = (dateStr) => {
        if (!dateStr) return "N/A";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return (
                date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                }) +
                ", " +
                date.toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                })
            );
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="dashboard-container">
            {/* Unified Application Navigation */}
            <Navbar />

            {/* Dashboard Intro & Action Buttons */}
            <div className="dashboard-hero-header">
                <div className="dashboard-hero-text">
                    <h1 className="dashboard-title">Dashboard</h1>
                    <p className="dashboard-subtitle">
                        Your journey, monitored automatically
                    </p>
                </div>

                {/* Two Clear Action Buttons */}
                <div className="dashboard-hero-actions">
                    <Link
                        to="/start-trip"
                        className="dashboard-hero-btn btn-primary"
                        id="hero-start-trip-btn"
                    >
                        <span aria-hidden="true">🚗</span>
                        <span>Start New Trip</span>
                    </Link>
                    <Link
                        to="/trip-history"
                        className="dashboard-hero-btn btn-secondary"
                        id="hero-trip-history-btn"
                    >
                        <span aria-hidden="true">📜</span>
                        <span>View Trip History</span>
                    </Link>
                </div>
            </div>

            {/* Error / Status Notice */}
            {message && (
                <div className="dashboard-notice-banner" role="alert">
                    <div className="notice-content">
                        <span className="notice-icon" aria-hidden="true">⚠️</span>
                        <span>{message}</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleRetry}
                        className="notice-retry-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? "Retrying..." : "Retry"}
                    </button>
                </div>
            )}

            {/* Summary Section */}
            <section className="dashboard-section summary-section" aria-label="Dashboard Summary">
                <div className="section-header-row">
                    <div className="section-title-wrap">
                        <h2 className="section-title">Summary</h2>
                        <span className="section-subtitle-tag">Overview</span>
                    </div>
                    {isLoading && (
                        <div className="summary-loading-badge">
                            <span className="summary-spinner-dot" aria-hidden="true"></span>
                            <span>Loading data...</span>
                        </div>
                    )}
                </div>

                <div className="summary-cards-grid">
                    {/* 1. Total Destinations */}
                    <div className="summary-stat-card">
                        <div className="summary-stat-icon-box dest-bg" aria-hidden="true">
                            <span>📍</span>
                        </div>
                        <div className="summary-stat-info">
                            <span className="summary-stat-number">
                                {isLoading ? <span className="skeleton-placeholder" /> : totalDestinations}
                            </span>
                            <span className="summary-stat-label">Total Destinations</span>
                        </div>
                    </div>

                    {/* 2. Total Trips */}
                    <div className="summary-stat-card">
                        <div className="summary-stat-icon-box total-bg" aria-hidden="true">
                            <span>🚗</span>
                        </div>
                        <div className="summary-stat-info">
                            <span className="summary-stat-number">
                                {isLoading ? <span className="skeleton-placeholder" /> : totalTrips}
                            </span>
                            <span className="summary-stat-label">Total Trips</span>
                        </div>
                    </div>

                    {/* 3. Completed Trips */}
                    <div className="summary-stat-card">
                        <div className="summary-stat-icon-box completed-bg" aria-hidden="true">
                            <span>✅</span>
                        </div>
                        <div className="summary-stat-info">
                            <span className="summary-stat-number">
                                {isLoading ? <span className="skeleton-placeholder" /> : completedTrips}
                            </span>
                            <span className="summary-stat-label">Completed Trips</span>
                        </div>
                    </div>

                    {/* 4. Active Trips */}
                    <div className="summary-stat-card">
                        <div className="summary-stat-icon-box active-bg" aria-hidden="true">
                            <span>🟢</span>
                        </div>
                        <div className="summary-stat-info">
                            <span className="summary-stat-number">
                                {isLoading ? <span className="skeleton-placeholder" /> : activeTrips}
                            </span>
                            <span className="summary-stat-label">Active Trips</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Action Cards */}
            <section className="dashboard-actions-section" aria-label="Main Actions">
                <div className="dashboard-actions-grid">
                    {/* Card 1: Start New Trip */}
                    <div className="action-card action-card-primary">
                        <div className="action-card-header">
                            <div className="action-card-icon-wrap car-icon-bg" aria-hidden="true">
                                <span className="action-card-icon">🚗</span>
                            </div>
                            <span className="action-card-tag">Quick Start</span>
                        </div>
                        <h2 className="action-card-title">Start New Trip</h2>
                        <p className="action-card-desc">
                            Choose a destination and set your alert distance.
                        </p>
                        <Link to="/start-trip" className="action-card-btn btn-primary" id="card-start-trip-btn">
                            <span>Start New Trip</span>
                            <span aria-hidden="true">→</span>
                        </Link>
                    </div>

                    {/* Card 2: View Trip History */}
                    <div className="action-card action-card-history">
                        <div className="action-card-header">
                            <div className="action-card-icon-wrap history-icon-bg" aria-hidden="true">
                                <span className="action-card-icon">📜</span>
                            </div>
                            <span className="action-card-tag">Trip Logs</span>
                        </div>
                        <h2 className="action-card-title">Trip History</h2>
                        <p className="action-card-desc">
                            Review your completed and active journeys.
                        </p>
                        <Link to="/trip-history" className="action-card-btn btn-secondary" id="card-trip-history-btn">
                            <span>View Trip History</span>
                            <span aria-hidden="true">→</span>
                        </Link>
                    </div>

                    {/* Card 3: Destinations */}
                    <div className="action-card action-card-secondary">
                        <div className="action-card-header">
                            <div className="action-card-icon-wrap pin-icon-bg" aria-hidden="true">
                                <span className="action-card-icon">📍</span>
                            </div>
                            <span className="action-card-tag">Saved Places</span>
                        </div>
                        <h2 className="action-card-title">Destinations</h2>
                        <p className="action-card-desc">
                            View and manage your saved destinations.
                        </p>
                        <Link to="/destinations" className="action-card-btn btn-secondary" id="card-destinations-btn">
                            <span>View Destinations</span>
                            <span aria-hidden="true">→</span>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Current Trip Section */}
            <section className="dashboard-section current-trip-section" aria-label="Current Trip Status">
                <div className="section-header-row">
                    <h2 className="section-title">Current Trip</h2>
                    {activeTrip && (
                        <div className="tracking-status-badge status-active">
                            <span className="status-dot" aria-hidden="true"></span>
                            <span>Tracking Active</span>
                        </div>
                    )}
                </div>

                {activeTrip ? (
                    <div className="current-trip-card">
                        <div className="current-trip-header">
                            <div className="current-trip-dest">
                                <span className="current-trip-tag">Destination</span>
                                <h3 className="current-trip-name">
                                    <span className="current-trip-pin" aria-hidden="true">📍</span>
                                    {getActiveTripDestination(activeTrip)}
                                </h3>
                                {activeTrip.id && (
                                    <span className="current-trip-id">
                                        Trip ID: #{activeTrip.id}
                                    </span>
                                )}
                            </div>

                            <div className="current-trip-badge-wrap">
                                <span className="status-badge-inline">
                                    <span className="tracking-dot" aria-hidden="true">🟢</span>
                                    <span>Active</span>
                                </span>
                            </div>
                        </div>

                        <div className="current-trip-metrics-grid">
                            <div className="metric-box">
                                <span className="metric-label">Alert Distance</span>
                                <div className="metric-val-wrap">
                                    <span className="metric-val">{activeTrip.alertDistanceKm}</span>
                                    <span className="metric-unit">km</span>
                                </div>
                                <span className="metric-caption">Proximity threshold</span>
                            </div>

                            <div className="metric-box">
                                <span className="metric-label">Tracking</span>
                                <div className="metric-val-wrap">
                                    <span className="metric-val tracking-active-text">🟢 Active</span>
                                </div>
                                <span className="metric-caption">Background GPS monitor</span>
                            </div>

                            <div className="metric-box">
                                <span className="metric-label">Started</span>
                                <div className="metric-val-wrap">
                                    <span
                                        className="metric-val metric-timestamp"
                                        title={String(activeTrip.startedAt)}
                                    >
                                        {formatDateTime(activeTrip.startedAt)}
                                    </span>
                                </div>
                                <span className="metric-caption">Departure time</span>
                            </div>
                        </div>

                        <div className="current-trip-actions">
                            <Link to="/active-trip" className="btn-view-active-trip">
                                <span aria-hidden="true">🧭</span>
                                <span>View Active Trip</span>
                                <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="no-active-trip-card">
                        <div className="no-trip-icon-wrap" aria-hidden="true">🧭</div>
                        <h3 className="no-trip-title">No Active Trip</h3>
                        <p className="no-trip-desc">
                            You don't have an active trip right now.
                        </p>
                        <Link to="/start-trip" className="no-trip-btn">
                            <span aria-hidden="true">🚀</span>
                            <span>Start a Trip</span>
                        </Link>
                    </div>
                )}
            </section>

            {/* Quick Information: How Travel Alarm Works */}
            <section className="dashboard-section how-it-works-section" aria-label="How Travel Alarm Works">
                <div className="section-header-row">
                    <h2 className="section-title">How Travel Alarm Works</h2>
                </div>
                <div className="how-it-works-grid">
                    <div className="step-card">
                        <div className="step-number" aria-hidden="true">1</div>
                        <h3 className="step-heading">Choose Destination</h3>
                        <p className="step-text">Choose your destination from your saved places.</p>
                    </div>
                    <div className="step-card">
                        <div className="step-number" aria-hidden="true">2</div>
                        <h3 className="step-heading">Set Alert Distance</h3>
                        <p className="step-text">Set your alert distance in kilometers before your stop.</p>
                    </div>
                    <div className="step-card">
                        <div className="step-number" aria-hidden="true">3</div>
                        <h3 className="step-heading">Start Trip</h3>
                        <p className="step-text">Start your trip to begin automatic proximity monitoring.</p>
                    </div>
                    <div className="step-card">
                        <div className="step-number" aria-hidden="true">4</div>
                        <h3 className="step-heading">Automatic GPS</h3>
                        <p className="step-text">Your GPS location is monitored automatically in real-time.</p>
                    </div>
                    <div className="step-card">
                        <div className="step-number" aria-hidden="true">5</div>
                        <h3 className="step-heading">Sound Alarm</h3>
                        <p className="step-text">You receive an alert when you reach the selected distance.</p>
                    </div>
                </div>
            </section>

            {/* Existing Trips History Section */}
            <section className="dashboard-section trips-history-section" aria-label="Trip History">
                <div className="section-header-row">
                    <div className="section-title-wrap">
                        <h2 className="section-title">My Trips</h2>
                        {trips.length > 0 && (
                            <span className="trips-count-badge">
                                {trips.length} {trips.length === 1 ? "trip" : "trips"}
                            </span>
                        )}
                    </div>
                    <Link to="/trip-history" className="view-all-trips-link" id="link-view-all-trips">
                        View Trip History →
                    </Link>
                </div>

                {trips.length === 0 ? (
                    <div className="trips-empty-card">
                        <span className="empty-trips-icon" aria-hidden="true">📋</span>
                        <p className="empty-trips-text">No trips found.</p>
                        <p className="empty-trips-subtext">
                            Trips you start will appear here in your trip history.
                        </p>
                    </div>
                ) : (
                    <div className="trips-list-grid">
                        {trips.map((trip) => (
                            <div key={trip.id} className="trip-history-item-card">
                                <div className="trip-card-top-row">
                                    <div className="trip-id-group">
                                        <span className="trip-item-icon" aria-hidden="true">🚗</span>
                                        <span className="trip-id-tag">
                                            Trip {trip.destinationName ? String(trip.destinationName).slice(0, 16) : (destinationsMap[trip.destinationId] ? String(destinationsMap[trip.destinationId]).slice(0, 16) : (trip.id ? `#${String(trip.id).slice(0, 8)}` : "N/A"))}
                                        </span>
                                    </div>
                                    <span
                                        className={`trip-status-pill ${trip.alertTriggered ? "pill-triggered" : "pill-normal"
                                            }`}
                                    >
                                        {trip.alertTriggered ? "🚨 Triggered" : "Normal"}
                                    </span>
                                </div>

                                <div className="trip-card-details">
                                    <div className="trip-detail-entry">
                                        <span className="detail-label">Alert Distance:</span>
                                        <span className="detail-value">{trip.alertDistanceKm} km</span>
                                    </div>
                                    <div className="trip-detail-entry">
                                        <span className="detail-label">Started At:</span>
                                        <span className="detail-value">
                                            {formatDateTime(trip.startedAt)}
                                        </span>
                                    </div>
                                    <div className="trip-detail-entry">
                                        <span className="detail-label">Status:</span>
                                        <span className="detail-value status-val">
                                            {trip.endedAt
                                                ? `Ended ${formatDateTime(trip.endedAt)}`
                                                : "🟢 Still running"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Footer */}
            <footer className="dashboard-footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <span className="footer-logo" aria-hidden="true">🧭</span>
                        <span className="footer-title">Travel Alarm</span>
                    </div>
                    <p className="footer-tagline">"Your destination proximity assistant"</p>
                    <p className="footer-copyright">
                        © {new Date().getFullYear()} Travel Alarm. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default Dashboard;