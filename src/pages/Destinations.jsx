import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { getApiErrorMessage } from "../utils/errorHandler";
import Navbar from "../components/Navbar";
import "./Destinations.css";

function Destinations() {
    const navigate = useNavigate();
    const [destinations, setDestinations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState("");

    // Add Destination form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        latitude: "",
        longitude: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    // Edit Destination state
    const [editingDestination, setEditingDestination] = useState(null);
    const [editFormData, setEditFormData] = useState({
        name: "",
        latitude: "",
        longitude: ""
    });
    const [isUpdating, setIsUpdating] = useState(false);
    const [editError, setEditError] = useState("");

    // Delete Destination state
    const [actionError, setActionError] = useState("");
    const [deletingId, setDeletingId] = useState(null);

    // Manual trigger for refresh or retry
    const fetchDestinations = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await api.get("/Destinations");
            console.log("Destinations response data:", response.data);

            const data = response.data;
            const list = Array.isArray(data)
                ? data
                : Array.isArray(data?.$values)
                ? data.$values
                : Array.isArray(data?.data)
                ? data.data
                : [];

            setDestinations(list);
        } catch (err) {
            console.error("Destinations fetch error:", err);
            const errMsg = getApiErrorMessage(err, "We couldn't load your destinations. Please try again.");
            if (err.response?.status === 401) {
                setError({
                    type: "auth",
                    message: errMsg
                });
                localStorage.removeItem("token");
                localStorage.removeItem("activeTrip");
                navigate("/login", { state: { message: errMsg } });
            } else {
                setError({
                    type: "network",
                    message: errMsg
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // 1. Initial Load Destinations from GET /Destinations
    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                const response = await api.get("/Destinations");
                console.log("Destinations response data:", response.data);

                if (!isMounted) return;

                const data = response.data;
                const list = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.$values)
                    ? data.$values
                    : Array.isArray(data?.data)
                    ? data.data
                    : [];

                setDestinations(list);
            } catch (err) {
                console.error("Destinations fetch error:", err);
                if (!isMounted) return;

                const errMsg = getApiErrorMessage(err, "We couldn't load your destinations. Please try again.");
                if (err.response?.status === 401) {
                    setError({
                        type: "auth",
                        message: errMsg
                    });
                    localStorage.removeItem("token");
                    localStorage.removeItem("activeTrip");
                    navigate("/login", { state: { message: errMsg } });
                } else {
                    setError({
                        type: "network",
                        message: errMsg
                    });
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

    const handleFormChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setFormError("");
    };

    // 2. Add / Create Destination via POST /Destinations
    const handleAddDestination = async (e) => {
        e.preventDefault();
        setFormError("");
        setSuccessMessage("");

        const trimmedName = formData.name.trim();
        if (!trimmedName) {
            setFormError("Destination name is required.");
            return;
        }

        const lat = parseFloat(formData.latitude);
        const lng = parseFloat(formData.longitude);

        if (isNaN(lat) || isNaN(lng)) {
            setFormError("Please enter valid numeric latitude and longitude coordinates.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await api.post("/Destinations", {
                name: trimmedName,
                latitude: lat,
                longitude: lng
            });

            console.log("Destination added successfully:", response.data);
            setSuccessMessage(`Destination "${trimmedName}" added successfully!`);
            setFormData({ name: "", latitude: "", longitude: "" });
            setShowAddForm(false);
            // Refresh destination list
            fetchDestinations();
        } catch (err) {
            console.error("Add destination error:", err);
            const errMsg = getApiErrorMessage(err, "Unable to create destination. Please try again.");
            setFormError(errMsg);
            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("activeTrip");
                setTimeout(() => navigate("/login", { state: { message: errMsg } }), 1200);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // 3. Edit Destination Handlers
    const handleStartEdit = (dest) => {
        setEditingDestination(dest);
        setEditFormData({
            name: dest.name ?? "",
            latitude: dest.latitude !== undefined && dest.latitude !== null ? String(dest.latitude) : "",
            longitude: dest.longitude !== undefined && dest.longitude !== null ? String(dest.longitude) : ""
        });
        setEditError("");
    };

    const handleCancelEdit = () => {
        setEditingDestination(null);
        setEditFormData({ name: "", latitude: "", longitude: "" });
        setEditError("");
    };

    const handleEditFormChange = (e) => {
        setEditFormData({
            ...editFormData,
            [e.target.name]: e.target.value
        });
        setEditError("");
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setEditError("");

        const name = editFormData.name.trim();
        if (!name) {
            setEditError("Name must not be empty.");
            return;
        }

        const { latitude, longitude } = editFormData;

        const latNum = Number(latitude);
        if (latitude === "" || isNaN(latNum) || latNum < -90 || latNum > 90) {
            setEditError("Latitude must be between -90 and 90.");
            return;
        }

        const lngNum = Number(longitude);
        if (longitude === "" || isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
            setEditError("Longitude must be between -180 and 180.");
            return;
        }

        const destinationId = editingDestination.id ?? editingDestination.destinationId;

        setIsUpdating(true);
        try {
            const response = await api.put(
                `/Destinations/${destinationId}`,
                {
                    name,
                    latitude: Number(latitude),
                    longitude: Number(longitude)
                }
            );

            console.log("Destination updated successfully:", response.data);

            const updatedItem = {
                ...editingDestination,
                name,
                latitude: Number(latitude),
                longitude: Number(longitude),
                ...(response.data && typeof response.data === "object" ? response.data : {})
            };

            setDestinations((prev) =>
                prev.map((dest) => {
                    const currentId = dest.id ?? dest.destinationId;
                    return currentId === destinationId ? updatedItem : dest;
                })
            );

            setEditingDestination(null);
            setEditFormData({ name: "", latitude: "", longitude: "" });
            setSuccessMessage("Destination updated successfully.");
        } catch (err) {
            console.error("Edit destination error:", err);
            const errMsg = getApiErrorMessage(err, "Failed to update destination. Please try again.");
            setEditError(errMsg);
            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("activeTrip");
                setTimeout(() => navigate("/login", { state: { message: errMsg } }), 1200);
            }
        } finally {
            setIsUpdating(false);
        }
    };

    // Close edit modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && editingDestination && !isUpdating) {
                handleCancelEdit();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [editingDestination, isUpdating]);

    // 4. Delete Destination Handler
    const handleDeleteDestination = async (destination) => {
        const isConfirmed = window.confirm("Are you sure you want to delete this destination?");
        if (!isConfirmed) {
            return;
        }

        const destinationId = destination.id ?? destination.destinationId;
        setDeletingId(destinationId);
        setActionError("");
        setSuccessMessage("");

        try {
            const response = await api.delete(`/Destinations/${destinationId}`);
            console.log("Delete destination response:", response);

            setDestinations((prev) =>
                prev.filter((dest) => (dest.id ?? dest.destinationId) !== destinationId)
            );
            setSuccessMessage("Destination deleted successfully.");
        } catch (err) {
            console.error("Delete destination error:", err);
            const errMsg = getApiErrorMessage(
                err,
                "This destination cannot be deleted because it is being used by an active trip."
            );
            setActionError(errMsg);
            if (err.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("activeTrip");
                setTimeout(() => navigate("/login", { state: { message: errMsg } }), 1200);
            }
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="destinations-container">
            {/* Unified Application Navigation */}
            <Navbar />

            {/* Header */}
            <header className="destinations-header">
                <div className="destinations-title-group">
                    <div className="destinations-title-wrap">
                        <span className="destinations-logo-icon" aria-hidden="true">📍</span>
                        <h1 className="destinations-title">Destinations</h1>
                    </div>
                    <p className="destinations-subtitle">
                        View and manage your saved trip destinations
                    </p>
                </div>

                <div className="destinations-header-actions">
                    <button
                        type="button"
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="btn-add-destination-toggle"
                    >
                        <span>{showAddForm ? "✕ Cancel" : "+ Add Destination"}</span>
                    </button>
                </div>
            </header>

            {/* Success Message Notice */}
            {successMessage && (
                <div className="dest-notice-banner notice-success" role="status">
                    <div className="notice-icon-box" aria-hidden="true">✓</div>
                    <div className="notice-content">
                        <span className="notice-text">{successMessage}</span>
                    </div>
                    <button
                        type="button"
                        className="notice-dismiss-btn"
                        onClick={() => setSuccessMessage("")}
                        aria-label="Dismiss message"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Action Error Notice */}
            {actionError && (
                <div className="dest-notice-banner notice-error" role="alert">
                    <div className="notice-icon-box" aria-hidden="true">⚠️</div>
                    <div className="notice-content">
                        <span className="notice-text">{actionError}</span>
                    </div>
                    <button
                        type="button"
                        className="notice-dismiss-btn"
                        onClick={() => setActionError("")}
                        aria-label="Dismiss message"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Add Destination Form */}
            {showAddForm && (
                <section className="add-destination-card" aria-label="Add Destination">
                    <h2 className="add-card-title">Add New Destination</h2>
                    <form onSubmit={handleAddDestination} className="add-dest-form">
                        <div className="form-group">
                            <label htmlFor="dest-name">Destination Name</label>
                            <input
                                id="dest-name"
                                type="text"
                                name="name"
                                placeholder="e.g. Pune, Mumbai, Central Station"
                                value={formData.name}
                                onChange={handleFormChange}
                                disabled={isSubmitting}
                                required
                            />
                        </div>

                        <div className="form-row-coords">
                            <div className="form-group">
                                <label htmlFor="dest-lat">Latitude</label>
                                <input
                                    id="dest-lat"
                                    type="number"
                                    step="any"
                                    name="latitude"
                                    placeholder="e.g. 18.5204"
                                    value={formData.latitude}
                                    onChange={handleFormChange}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="dest-lng">Longitude</label>
                                <input
                                    id="dest-lng"
                                    type="number"
                                    step="any"
                                    name="longitude"
                                    placeholder="e.g. 73.8567"
                                    value={formData.longitude}
                                    onChange={handleFormChange}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>
                        </div>

                        {formError && (
                            <div className="form-error-text" role="alert">
                                <span>⚠️</span> {formError}
                            </div>
                        )}

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="btn-submit-dest"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Saving..." : "Save Destination"}
                            </button>
                            <button
                                type="button"
                                className="btn-cancel-dest"
                                onClick={() => { setShowAddForm(false); setFormError(""); }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* SEPARATE STATES */}

            {/* 1. Loading State */}
            {isLoading && (
                <div className="destinations-state-card state-loading" role="status" aria-live="polite">
                    <div className="loading-spinner-ring" aria-hidden="true"></div>
                    <h2 className="state-title">Loading destinations...</h2>
                    <p className="state-desc">Fetching your saved places from the server.</p>
                </div>
            )}

            {/* 2. API / Error State (Never masked behind "No destinations found") */}
            {!isLoading && error && (
                <div className="destinations-state-card state-error" role="alert">
                    <div className="state-error-icon-wrap" aria-hidden="true">
                        <span className="state-icon">⚠️</span>
                    </div>
                    <h2 className="state-title">Unable to Load Destinations</h2>
                    <p className="state-desc">
                        {error.message ||
                            (error.type === "auth"
                                ? "Session expired. Please login again."
                                : "Something went wrong. Please try again.")}
                    </p>
                    <div className="state-actions">
                        <button
                            type="button"
                            onClick={fetchDestinations}
                            className="btn-primary-action btn-retry"
                        >
                            <span aria-hidden="true">🔄</span>
                            <span>Try Again</span>
                        </button>
                        {error.type === "auth" && (
                            <Link to="/login" className="btn-secondary-action">
                                Log In Again
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* 3. Successful Empty Result (Never shown on error or loading) */}
            {!isLoading && !error && destinations.length === 0 && (
                <div className="destinations-state-card state-empty">
                    <div className="state-empty-icon-wrap" aria-hidden="true">
                        <span className="state-icon">📍</span>
                    </div>
                    <h2 className="state-title">No Destinations Yet</h2>
                    <p className="state-desc">
                        You haven't added any destinations.
                    </p>
                    <div className="state-actions">
                        <button
                            type="button"
                            onClick={() => setShowAddForm(true)}
                            className="btn-primary-action btn-add-dest-empty"
                        >
                            <span aria-hidden="true">+</span>
                            <span>Add Destination</span>
                        </button>
                    </div>
                </div>
            )}

            {/* 4. Successful Destinations List */}
            {!isLoading && !error && destinations.length > 0 && (
                <section className="destinations-list-section" aria-label="Saved Destinations">
                    <div className="destinations-count-row">
                        <span className="destinations-count-tag">
                            {destinations.length} {destinations.length === 1 ? "Destination" : "Destinations"}
                        </span>
                    </div>

                    <div className="destinations-grid">
                        {destinations.map((destination) => (
                            <article key={destination.id} className="destination-card">
                                <div className="dest-card-header">
                                    <div className="dest-card-title-wrap">
                                        <span className="dest-pin-icon" aria-hidden="true">📍</span>
                                        <h2 className="dest-card-name">{destination.name}</h2>
                                    </div>
                                    {destination.id && (
                                        <span
                                            className="dest-id-tag"
                                            title={`ID: ${destination.id}`}
                                        >
                                            #{String(destination.id).slice(0, 8)}
                                        </span>
                                    )}
                                </div>

                                <div className="dest-coords-box">
                                    <div className="coord-row">
                                        <span className="coord-label">Latitude:</span>
                                        <span className="coord-val">{destination.latitude}</span>
                                    </div>
                                    <div className="coord-row">
                                        <span className="coord-label">Longitude:</span>
                                        <span className="coord-val">{destination.longitude}</span>
                                    </div>
                                </div>

                                <div className="dest-card-actions">
                                    <button
                                        type="button"
                                        className="btn-edit-dest"
                                        onClick={() => handleStartEdit(destination)}
                                        title={`Edit ${destination.name}`}
                                    >
                                        <span aria-hidden="true">✏️</span>
                                        <span>Edit</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-delete-dest"
                                        onClick={() => handleDeleteDestination(destination)}
                                        disabled={deletingId === (destination.id ?? destination.destinationId)}
                                        title={`Delete ${destination.name}`}
                                    >
                                        <span aria-hidden="true">🗑️</span>
                                        <span>{deletingId === (destination.id ?? destination.destinationId) ? "Deleting..." : "Delete"}</span>
                                    </button>
                                    <Link
                                        to="/start-trip"
                                        className="btn-start-trip-dest"
                                        title={`Start trip to ${destination.name}`}
                                    >
                                        <span aria-hidden="true">🚗</span>
                                        <span>Start Trip</span>
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {/* 5. Edit Destination Modal */}
            {editingDestination && (
                <div
                    className="dest-modal-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="edit-dest-modal-title"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isUpdating) {
                            handleCancelEdit();
                        }
                    }}
                >
                    <div className="dest-modal-card">
                        <div className="dest-modal-header">
                            <div className="dest-modal-title-group">
                                <span className="dest-modal-icon" aria-hidden="true">✏️</span>
                                <h2 id="edit-dest-modal-title" className="dest-modal-title">
                                    Edit Destination
                                </h2>
                            </div>
                            <button
                                type="button"
                                className="dest-modal-close-btn"
                                onClick={handleCancelEdit}
                                disabled={isUpdating}
                                aria-label="Close edit modal"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="add-dest-form">
                            <div className="form-group">
                                <label htmlFor="edit-dest-name">Destination Name</label>
                                <input
                                    id="edit-dest-name"
                                    type="text"
                                    name="name"
                                    placeholder="e.g. Pune, Mumbai, Central Station"
                                    value={editFormData.name}
                                    onChange={handleEditFormChange}
                                    disabled={isUpdating}
                                    required
                                />
                            </div>

                            <div className="form-row-coords">
                                <div className="form-group">
                                    <label htmlFor="edit-dest-lat">Latitude</label>
                                    <input
                                        id="edit-dest-lat"
                                        type="number"
                                        step="any"
                                        name="latitude"
                                        placeholder="e.g. 18.5204"
                                        value={editFormData.latitude}
                                        onChange={handleEditFormChange}
                                        disabled={isUpdating}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="edit-dest-lng">Longitude</label>
                                    <input
                                        id="edit-dest-lng"
                                        type="number"
                                        step="any"
                                        name="longitude"
                                        placeholder="e.g. 73.8567"
                                        value={editFormData.longitude}
                                        onChange={handleEditFormChange}
                                        disabled={isUpdating}
                                        required
                                    />
                                </div>
                            </div>

                            {editError && (
                                <div className="form-error-text" role="alert">
                                    <span>⚠️</span> {editError}
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="submit"
                                    className="btn-submit-dest"
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? "Updating destination..." : "Save"}
                                </button>
                                <button
                                    type="button"
                                    className="btn-cancel-dest"
                                    onClick={handleCancelEdit}
                                    disabled={isUpdating}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Destinations;