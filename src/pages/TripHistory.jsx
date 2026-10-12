import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { getApiErrorMessage } from "../utils/errorHandler";
import Navbar from "../components/Navbar";
import "./TripHistory.css";

// Helper to format ISO date strings into clean, readable date and time
function formatDateTime(isoString) {
    if (!isoString) return "—";
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString;
        return date.toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch {
        return isoString;
    }
}

function TripHistory() {
    const navigate = useNavigate();

    const [trips, setTrips] = useState([]);
    const [destinationsMap, setDestinationsMap] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState("all"); // "all" | "active" | "completed"

    // Initial load on mount
    useEffect(() => {
        let isMounted = true;
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        const load = async () => {
            try {
                const [tripsRes, destsRes] = await Promise.allSettled([
                    api.get("/Trips"),
                    api.get("/Destinations")
                ]);

                if (!isMounted) return;

                if (destsRes.status === "fulfilled" && destsRes.value?.data) {
                    const rawDests = destsRes.value.data;
                    const destList = Array.isArray(rawDests)
                        ? rawDests
                        : rawDests?.$values || rawDests?.data || [];

                    const map = {};
                    destList.forEach((d) => {
                        if (d?.id && d?.name) {
                            map[d.id] = d.name;
                            map[String(d.id).toLowerCase()] = d.name;
                        }
                    });
                    setDestinationsMap(map);
                }

                if (tripsRes.status === "fulfilled") {
                    const rawTrips = tripsRes.value.data;
                    const tripsList = Array.isArray(rawTrips)
                        ? rawTrips
                        : rawTrips?.$values || rawTrips?.data || [];

                    tripsList.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
                    setTrips(tripsList);
                } else {
                    throw tripsRes.reason;
                }
            } catch (err) {
                console.error("Trip history error:", err);
                if (!isMounted) return;
                const errMsg = getApiErrorMessage(err, "Unable to load trip history.");
                if (err.response?.status === 401) {
                    localStorage.removeItem("token");
                    navigate("/login", { state: { message: errMsg } });
                    return;
                }
                setError(errMsg);
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

    // Manual refresh handler
    const handleRefresh = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const [tripsRes, destsRes] = await Promise.allSettled([
                api.get("/Trips"),
                api.get("/Destinations")
            ]);

            if (destsRes.status === "fulfilled" && destsRes.value?.data) {
                const rawDests = destsRes.value.data;
                const destList = Array.isArray(rawDests)
                    ? rawDests
                    : rawDests?.$values || rawDests?.data || [];

                const map = {};
                destList.forEach((d) => {
                    if (d?.id && d?.name) {
                        map[d.id] = d.name;
                        map[String(d.id).toLowerCase()] = d.name;
                    }
                });
                setDestinationsMap(map);
            }

            if (tripsRes.status === "fulfilled") {
                const rawTrips = tripsRes.value.data;
                const tripsList = Array.isArray(rawTrips)
                    ? rawTrips
                    : rawTrips?.$values || rawTrips?.data || [];

                tripsList.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
                setTrips(tripsList);
            } else {
                throw tripsRes.reason;
            }
        } catch (err) {
            console.error("Trip history refresh error:", err);
            const errMsg = getApiErrorMessage(err, "Unable to load trip history.");
            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                navigate("/login", { state: { message: errMsg } });
                return;
            }
            setError(errMsg);
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    // Helpers based on prompt specifications
    const getTripStatus = (trip) => {
        return trip.endedAt ? "Completed" : "Active";
    };

    const getAlertTriggeredText = (trip) => {
        return trip.alertTriggered ? "Alert Triggered" : "Not Triggered";
    };

    // Filtered trips
    const filteredTrips = trips.filter((trip) => {
        if (filterStatus === "active") return !trip.endedAt;
        if (filterStatus === "completed") return Boolean(trip.endedAt);
        return true;
    });

    const activeCount = trips.filter((t) => !t.endedAt).length;
    const completedCount = trips.filter((t) => Boolean(t.endedAt)).length;
    const alertTriggeredCount = trips.filter((t) => t.alertTriggered).length;

    return (
        <div className="trip-history-container">
            {/* Unified Navigation */}
            <Navbar />

            {/* Header & Page Title */}
            <header className="trip-history-header">
                <div className="trip-history-title-group">
                    <div className="trip-history-title-wrap">
                        <span className="trip-history-logo-icon" aria-hidden="true">📜</span>
                        <h1 className="trip-history-title">Trip History</h1>
                    </div>
                    <p className="trip-history-subtitle">
                        Review your past and active travel alerts and destinations
                    </p>
                </div>

                <div className="trip-history-header-actions">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="btn-header-action btn-refresh-history"
                        title="Reload trips"
                    >
                        <span aria-hidden="true">🔄</span>
                        <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
                    </button>
                    <Link
                        to="/start-trip"
                        className="btn-header-action btn-start-trip-header"
                        title="Start a new travel trip"
                    >
                        <span aria-hidden="true">🚀</span>
                        <span>Start Trip</span>
                    </Link>
                </div>
            </header>

            {/* Metric Summary Cards */}
            {!isLoading && !error && trips.length > 0 && (
                <div className="history-stats-bar">
                    <div className="history-stat-card">
                        <div className="stat-icon-box total-bg" aria-hidden="true">🗺️</div>
                        <div className="stat-details">
                            <span className="stat-number">{trips.length}</span>
                            <span className="stat-label">Total Trips</span>
                        </div>
                    </div>

                    <div className="history-stat-card">
                        <div className="stat-icon-box active-bg" aria-hidden="true">🟢</div>
                        <div className="stat-details">
                            <span className="stat-number">{activeCount}</span>
                            <span className="stat-label">Active Trips</span>
                        </div>
                    </div>

                    <div className="history-stat-card">
                        <div className="stat-icon-box completed-bg" aria-hidden="true">🏁</div>
                        <div className="stat-details">
                            <span className="stat-number">{completedCount}</span>
                            <span className="stat-label">Completed Trips</span>
                        </div>
                    </div>

                    <div className="history-stat-card">
                        <div className="stat-icon-box alert-bg" aria-hidden="true">🚨</div>
                        <div className="stat-details">
                            <span className="stat-number">{alertTriggeredCount}</span>
                            <span className="stat-label">Alerts Triggered</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter and Count Bar */}
            {!isLoading && !error && trips.length > 0 && (
                <div className="history-controls-row">
                    <div className="history-filter-tabs" role="tablist" aria-label="Filter trips by status">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={filterStatus === "all"}
                            className={`filter-tab ${filterStatus === "all" ? "active" : ""}`}
                            onClick={() => setFilterStatus("all")}
                        >
                            All ({trips.length})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={filterStatus === "active"}
                            className={`filter-tab ${filterStatus === "active" ? "active" : ""}`}
                            onClick={() => setFilterStatus("active")}
                        >
                            Active ({activeCount})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={filterStatus === "completed"}
                            className={`filter-tab ${filterStatus === "completed" ? "active" : ""}`}
                            onClick={() => setFilterStatus("completed")}
                        >
                            Completed ({completedCount})
                        </button>
                    </div>

                    <span className="history-count-badge">
                        Showing {filteredTrips.length} {filteredTrips.length === 1 ? "trip" : "trips"}
                    </span>
                </div>
            )}

            {/* State: 1. Loading */}
            {isLoading && (
                <div className="trip-history-state-card state-loading" role="status" aria-live="polite">
                    <div className="loading-spinner-ring" aria-hidden="true"></div>
                    <h2 className="state-title">Loading trip history...</h2>
                    <p className="state-desc">Fetching your past travel logs...</p>
                </div>
            )}

            {/* State: 2. API Error */}
            {!isLoading && error && (
                <div className="trip-history-state-card state-error" role="alert">
                    <div className="state-error-icon-wrap" aria-hidden="true">
                        <span className="state-icon">⚠️</span>
                    </div>
                    <h2 className="state-title">Unable to load trip history.</h2>
                    <p className="state-desc">
                        {typeof error === "string"
                            ? error
                            : error?.message || "Something went wrong. Please try again."}
                    </p>
                    <div className="state-actions">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="btn-primary-action btn-retry"
                        >
                            <span aria-hidden="true">🔄</span>
                            <span>Try Again</span>
                        </button>
                    </div>
                </div>
            )}

            {/* State: 3. Empty Result */}
            {!isLoading && !error && trips.length === 0 && (
                <div className="trip-history-state-card state-empty">
                    <div className="state-empty-icon-wrap" aria-hidden="true">
                        <span className="state-icon">📋</span>
                    </div>
                    <h2 className="state-title">No trips found.</h2>
                    <p className="state-desc">
                        You have not recorded any trips yet. Choose a destination and start your first journey to begin proximity tracking.
                    </p>
                    <div className="state-actions">
                        <Link to="/start-trip" className="btn-primary-action">
                            <span aria-hidden="true">🚀</span>
                            <span>Start a Trip</span>
                        </Link>
                    </div>
                </div>
            )}

            {/* State: 4. Trips Table and Responsive Cards */}
            {!isLoading && !error && trips.length > 0 && (
                <>
                    {/* Desktop / Tablet Table View */}
                    <div className="trip-history-table-card" aria-label="Trip History Table">
                        <div className="table-responsive-wrapper">
                            <table className="trip-history-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Trip ID</th>
                                        <th scope="col">Destination ID</th>
                                        <th scope="col">Started At</th>
                                        <th scope="col">Ended At</th>
                                        <th scope="col">Alert Distance</th>
                                        <th scope="col">Alert Triggered</th>
                                        <th scope="col">Status</th>
                                        <th scope="col">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTrips.map((trip, index) => {
                                        const status = getTripStatus(trip);
                                        const alertTriggered = getAlertTriggeredText(trip);
                                        const destName =
                                            destinationsMap[trip.destinationId] ||
                                            destinationsMap[String(trip.destinationId).toLowerCase()] ||
                                            trip.destinationName ||
                                            (trip.destination?.name ? trip.destination.name : null);

                                        return (
                                            <tr key={trip.id || index}>
                                                {/* Trip ID */}
                                                <td>
                                                    <div className="cell-trip-id">
                                                        <span
                                                            className="trip-id-tag"
                                                            title={trip.id}
                                                        >
                                                            #{String(trip.id).slice(0, 8)}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Destination ID */}
                                                <td>
                                                    <div className="cell-dest">
                                                        {destName && (
                                                            <span className="dest-name-lead">
                                                                <span aria-hidden="true">📍</span>
                                                                <span>{destName}</span>
                                                            </span>
                                                        )}
                                                        <span
                                                            className="dest-id-sub"
                                                            title={`Destination ID: ${trip.destinationId}`}
                                                        >
                                                            {trip.destinationId
                                                                ? String(trip.destinationId).slice(0, 8) + "..."
                                                                : "N/A"}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Started At */}
                                                <td>
                                                    <span className="cell-date-time">
                                                        {formatDateTime(trip.startedAt)}
                                                    </span>
                                                </td>

                                                {/* Ended At */}
                                                <td>
                                                    <span
                                                        className={`cell-date-time ${
                                                            !trip.endedAt ? "cell-date-empty" : ""
                                                        }`}
                                                    >
                                                        {formatDateTime(trip.endedAt)}
                                                    </span>
                                                </td>

                                                {/* Alert Distance */}
                                                <td>
                                                    <span className="cell-dist">
                                                        {trip.alertDistanceKm != null
                                                            ? `${trip.alertDistanceKm} km`
                                                            : "N/A"}
                                                    </span>
                                                </td>

                                                {/* Alert Triggered */}
                                                <td>
                                                    <span
                                                        className={`alert-badge ${
                                                            trip.alertTriggered
                                                                ? "triggered"
                                                                : "not-triggered"
                                                        }`}
                                                    >
                                                        <span aria-hidden="true">
                                                            {trip.alertTriggered ? "🚨" : "🔔"}
                                                        </span>
                                                        <span>{alertTriggered}</span>
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td>
                                                    <span
                                                        className={`status-badge ${
                                                            status === "Active"
                                                                ? "status-active"
                                                                : "status-completed"
                                                        }`}
                                                    >
                                                        {status === "Active" && (
                                                            <span
                                                                className="pulse-dot"
                                                                aria-hidden="true"
                                                            ></span>
                                                        )}
                                                        <span>{status}</span>
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td>
                                                    {status === "Active" ? (
                                                        <Link
                                                            to="/active-trip"
                                                            className="trip-row-action-link"
                                                            title="Go to active tracking"
                                                        >
                                                            <span>Track Live</span>
                                                            <span aria-hidden="true">→</span>
                                                        </Link>
                                                    ) : (
                                                        <Link
                                                            to="/start-trip"
                                                            className="trip-row-action-link"
                                                            title="Start another trip"
                                                        >
                                                            <span>Repeat</span>
                                                            <span aria-hidden="true">↻</span>
                                                        </Link>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Cards View */}
                    <div className="mobile-cards-grid" aria-label="Trip History Cards">
                        {filteredTrips.map((trip, index) => {
                            const status = getTripStatus(trip);
                            const alertTriggered = getAlertTriggeredText(trip);
                            const destName =
                                destinationsMap[trip.destinationId] ||
                                destinationsMap[String(trip.destinationId).toLowerCase()] ||
                                trip.destinationName ||
                                (trip.destination?.name ? trip.destination.name : null);

                            return (
                                <article key={trip.id || index} className="mobile-trip-card">
                                    <div className="mobile-card-header">
                                        <div className="mobile-dest-info">
                                            {destName && (
                                                <strong className="dest-name-lead">
                                                    📍 {destName}
                                                </strong>
                                            )}
                                            <span className="dest-id-sub">
                                                Dest ID: {trip.destinationId ? String(trip.destinationId).slice(0, 10) + "..." : "N/A"}
                                            </span>
                                        </div>
                                        <span
                                            className={`status-badge ${
                                                status === "Active" ? "status-active" : "status-completed"
                                            }`}
                                        >
                                            {status === "Active" && <span className="pulse-dot" aria-hidden="true"></span>}
                                            <span>{status}</span>
                                        </span>
                                    </div>

                                    <div className="mobile-card-fields">
                                        <div className="mobile-field-item">
                                            <span className="mobile-field-label">Trip ID</span>
                                            <span className="mobile-field-value trip-id-tag">
                                                #{String(trip.id).slice(0, 8)}
                                            </span>
                                        </div>

                                        <div className="mobile-field-item">
                                            <span className="mobile-field-label">Alert Distance</span>
                                            <span className="mobile-field-value cell-dist">
                                                {trip.alertDistanceKm != null ? `${trip.alertDistanceKm} km` : "N/A"}
                                            </span>
                                        </div>

                                        <div className="mobile-field-item">
                                            <span className="mobile-field-label">Started At</span>
                                            <span className="mobile-field-value">
                                                {formatDateTime(trip.startedAt)}
                                            </span>
                                        </div>

                                        <div className="mobile-field-item">
                                            <span className="mobile-field-label">Ended At</span>
                                            <span className="mobile-field-value">
                                                {formatDateTime(trip.endedAt)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mobile-card-footer">
                                        <span
                                            className={`alert-badge ${
                                                trip.alertTriggered ? "triggered" : "not-triggered"
                                            }`}
                                        >
                                            <span aria-hidden="true">{trip.alertTriggered ? "🚨" : "🔔"}</span>
                                            <span>{alertTriggered}</span>
                                        </span>

                                        {status === "Active" ? (
                                            <Link to="/active-trip" className="trip-row-action-link">
                                                <span>Track Live →</span>
                                            </Link>
                                        ) : (
                                            <Link to="/start-trip" className="trip-row-action-link">
                                                <span>Repeat ↻</span>
                                            </Link>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

export default TripHistory;
