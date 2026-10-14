import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Safely resolve logged-in user display name from localStorage or token
    const [userName] = useState(() => {
        try {
            const storedName = localStorage.getItem("userName") || localStorage.getItem("user");
            if (storedName && typeof storedName === "string" && !storedName.startsWith("{")) {
                return storedName;
            }
            if (storedName && storedName.startsWith("{")) {
                const parsed = JSON.parse(storedName);
                if (parsed.name) return parsed.name;
                if (parsed.email) return parsed.email.split("@")[0];
            }

            const token = localStorage.getItem("token");
            if (token) {
                const parts = token.split(".");
                if (parts.length === 3) {
                    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
                    const jsonPayload = decodeURIComponent(
                        atob(base64)
                            .split("")
                            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                            .join("")
                    );
                    const decoded = JSON.parse(jsonPayload);
                    return (
                        decoded.name ||
                        decoded.unique_name ||
                        decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ||
                        (decoded.email ? decoded.email.split("@")[0] : null) ||
                        "Traveler"
                    );
                }
            }
        } catch {
            // fallback
        }
        return "Traveler";
    });

    // Logout: clear user-specific cached trip information and token without stopping the database trip
    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("activeTrip");
        localStorage.removeItem("userName");
        localStorage.removeItem("user");
        navigate("/login");
    };

    // Close mobile menu whenever route changes without triggering cascading renders in effect
    const [prevPathname, setPrevPathname] = useState(location.pathname);
    if (prevPathname !== location.pathname) {
        setPrevPathname(location.pathname);
        if (mobileMenuOpen) {
            setMobileMenuOpen(false);
        }
    }

    // Close mobile menu on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setMobileMenuOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const navItems = [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/destinations", label: "Destinations" },
        { path: "/start-trip", label: "Start Trip" },
        { path: "/active-trip", label: "Active Trip" },
        { path: "/trip-history", label: "Trip History" }
    ];

    return (
        <header className="app-navbar" role="banner">
            <div className="app-navbar-inner">
                {/* Branding: 🚗 Travel Alarm -> navigates to /dashboard */}
                <Link
                    to="/dashboard"
                    className="app-navbar-brand"
                    title="Travel Alarm - Go to Dashboard"
                >
                    <span className="app-navbar-brand-icon" aria-hidden="true">🚗</span>
                    <span className="app-navbar-brand-text">Travel Alarm</span>
                </Link>

                {/* Desktop Navigation Links */}
                <nav className="app-navbar-links" aria-label="Main Navigation">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `app-navbar-link ${isActive ? "active" : ""}`
                            }
                        >
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Desktop User Info & Logout */}
                <div className="app-navbar-right">
                    {userName && (
                        <div className="app-navbar-user-pill" title={`Logged in as ${userName}`}>
                            <span className="app-navbar-user-icon" aria-hidden="true">👤</span>
                            <span className="app-navbar-user-greeting">
                                Welcome, <strong>{userName}</strong>
                            </span>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="app-navbar-logout-btn"
                        title="Log out of your account"
                    >
                        <span>Logout</span>
                        <span className="app-navbar-logout-icon" aria-hidden="true">↳</span>
                    </button>
                </div>

                {/* Responsive Mobile Hamburger Toggle */}
                <button
                    type="button"
                    className="app-navbar-mobile-toggle"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-expanded={mobileMenuOpen}
                    aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                >
                    <span className="hamburger-box">
                        <span className={`hamburger-bar ${mobileMenuOpen ? "open top" : ""}`}></span>
                        <span className={`hamburger-bar ${mobileMenuOpen ? "open middle" : ""}`}></span>
                        <span className={`hamburger-bar ${mobileMenuOpen ? "open bottom" : ""}`}></span>
                    </span>
                </button>
            </div>

            {/* Responsive Mobile Menu Drawer */}
            {mobileMenuOpen && (
                <div className="app-navbar-mobile-drawer" role="navigation" aria-label="Mobile Navigation">
                    {userName && (
                        <div className="app-navbar-mobile-user">
                            <span className="app-navbar-user-icon" aria-hidden="true">👤</span>
                            <span className="app-navbar-mobile-welcome">
                                Welcome, <strong>{userName}</strong>
                            </span>
                        </div>
                    )}

                    <div className="app-navbar-mobile-links">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `app-navbar-mobile-link ${isActive ? "active" : ""}`
                                }
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>

                    <div className="app-navbar-mobile-actions">
                        <button
                            type="button"
                            onClick={() => {
                                setMobileMenuOpen(false);
                                handleLogout();
                            }}
                            className="app-navbar-mobile-logout-btn"
                        >
                            <span>Logout</span>
                            <span aria-hidden="true">↳</span>
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}

export default Navbar;
