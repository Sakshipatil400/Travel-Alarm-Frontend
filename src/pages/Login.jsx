import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import { getApiErrorMessage } from "../utils/errorHandler";
import "./Login.css";

function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });

    const [message, setMessage] = useState(() => location.state?.message || "");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setIsLoading(true);
            const response = await api.post(
                "/Auth/login",
                formData
            );

            console.log("Login response:", response.data);

            // Store JWT token
            localStorage.setItem("token", response.data.token);

            // Store user info if returned
            if (response.data.user) {
                localStorage.setItem(
                    "user",
                    typeof response.data.user === "object"
                        ? JSON.stringify(response.data.user)
                        : response.data.user
                );
            }
            if (response.data.userName) {
                localStorage.setItem("userName", response.data.userName);
            } else if (response.data.name) {
                localStorage.setItem("userName", response.data.name);
            }

            setMessage("Login successful!");

            // Navigate to Dashboard
            navigate("/dashboard");
        } catch (error) {
            console.error("Login error:", error);
            if (error?.response?.status === 401) {
                setMessage("Incorrect username or password.");
            } else {
                const errMsg = getApiErrorMessage(error, "Login failed.");
                setMessage(
                    errMsg === "Session expired. Please login again."
                        ? "Incorrect username or password."
                        : errMsg
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="login-container">
                {/* Left / Branding Section */}
                <div className="login-brand-panel">
                    <div className="login-brand-top">
                        <div className="login-brand-badge" aria-hidden="true">
                            🚗
                        </div>
                        <div className="login-brand-heading-wrap">
                            <h1 className="login-brand-title">Travel Alarm</h1>
                            <p className="login-brand-tagline">
                                Your journey, monitored automatically.
                            </p>
                        </div>
                        <p className="login-brand-desc">
                            Stay focused on your journey while Travel Alarm monitors your distance to the destination.
                        </p>
                    </div>

                    <ul className="login-feature-list" aria-label="Key features">
                        <li className="login-feature-item">
                            <span className="feature-icon-pill" aria-hidden="true">📍</span>
                            <span>Proximity destination alerts</span>
                        </li>
                        <li className="login-feature-item">
                            <span className="feature-icon-pill" aria-hidden="true">🛰️</span>
                            <span>Automatic location monitoring</span>
                        </li>
                        <li className="login-feature-item">
                            <span className="feature-icon-pill" aria-hidden="true">🔔</span>
                            <span>Timely wake-up notification</span>
                        </li>
                    </ul>
                </div>

                {/* Right / Login Card */}
                <div className="login-form-card">
                    <div className="login-card-header">
                        <h2 className="login-card-title">Welcome Back</h2>
                        <p className="login-card-subtitle">
                            Login to continue your journey.
                        </p>
                    </div>

                    {/* Error / Status Alert Area */}
                    {message && (
                        <div
                            className={`login-message-banner ${
                                message.includes("successful")
                                    ? "message-success"
                                    : "message-error"
                            }`}
                            role="alert"
                        >
                            <span className="message-icon" aria-hidden="true">
                                {message.includes("successful") ? "✓" : "⚠️"}
                            </span>
                            <span>{message}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="login-form">
                        {/* Email field */}
                        <div className="form-group">
                            <label htmlFor="login-email" className="form-label">
                                Email Address
                            </label>
                            <input
                                id="login-email"
                                className="form-input"
                                type="email"
                                name="email"
                                placeholder="Enter your email address"
                                value={formData.email}
                                onChange={handleChange}
                                autoComplete="email"
                                required
                            />
                        </div>

                        {/* Password field */}
                        <div className="form-group">
                            <label htmlFor="login-password" className="form-label">
                                Password
                            </label>
                            <div className="password-input-wrapper">
                                <input
                                    id="login-password"
                                    className="form-input"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="Enter your password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="btn-toggle-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                    title={showPassword ? "Hide password" : "Show password"}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="btn-login-submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="btn-spinner" aria-hidden="true"></span>
                                    <span>Logging in...</span>
                                </>
                            ) : (
                                <span>Login</span>
                            )}
                        </button>
                    </form>

                    {/* Register Link */}
                    <div className="login-card-footer">
                        <span>Don't have an account?</span>
                        <Link to="/register" className="login-register-link">
                            Create an account
                        </Link>
                    </div>
                </div>
            </div>

            {/* Optional Footer */}
            <footer className="login-page-footer">
                <span>Travel Alarm</span>
                <span className="footer-bullet" aria-hidden="true">•</span>
                <span>Your destination proximity assistant</span>
            </footer>
        </div>
    );
}

export default Login;