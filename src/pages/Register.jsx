import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { getApiErrorMessage } from "../utils/errorHandler";
import "./Register.css";

function Register() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: ""
    });

    const [message, setMessage] = useState("");
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
                "/Auth/register",
                formData
            );

            setMessage("Registration successful!");
            console.log("Registration response:", response.data);
        } catch (error) {
            console.error("Registration error:", error);
            setMessage(getApiErrorMessage(error, "Registration failed."));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="register-page-wrapper">
            <div className="register-container">
                {/* Left / Branding Section */}
                <div className="register-brand-panel">
                    <div className="register-brand-top">
                        <div className="register-brand-badge" aria-hidden="true">
                            🚗
                        </div>
                        <div className="register-brand-heading-wrap">
                            <h1 className="register-brand-title">Travel Alarm</h1>
                            <p className="register-brand-tagline">
                                Your journey, monitored automatically.
                            </p>
                        </div>
                        <p className="register-brand-desc">
                            Create your account and let Travel Alarm help you stay aware of your destination.
                        </p>
                    </div>

                    {/* How Travel Alarm works informational UI */}
                    <div className="how-it-works-box">
                        <h3 className="how-it-works-heading">
                            <span>💡</span> How Travel Alarm works
                        </h3>
                        <ul className="how-it-works-list">
                            <li className="how-it-works-step">
                                <span className="step-icon" aria-hidden="true">📍</span>
                                <span>Choose your destination</span>
                            </li>
                            <li className="how-it-works-step">
                                <span className="step-icon" aria-hidden="true">🔔</span>
                                <span>Set your alert distance</span>
                            </li>
                            <li className="how-it-works-step">
                                <span className="step-icon" aria-hidden="true">🚗</span>
                                <span>Start your trip</span>
                            </li>
                            <li className="how-it-works-step">
                                <span className="step-icon" aria-hidden="true">🚨</span>
                                <span>Get alerted near your destination</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Right / Register Card */}
                <div className="register-form-card">
                    <div className="register-card-header">
                        <h2 className="register-card-title">Create Your Account</h2>
                        <p className="register-card-subtitle">
                            Start your journey with Travel Alarm.
                        </p>
                    </div>

                    {/* Error / Status Alert Area */}
                    {message && (
                        <div
                            className={`register-message-banner ${
                                message.includes("successful")
                                    ? "message-success"
                                    : "message-error"
                            }`}
                            role="alert"
                        >
                            <div className="message-content-wrap">
                                <span className="message-icon" aria-hidden="true">
                                    {message.includes("successful") ? "✓" : "⚠️"}
                                </span>
                                <span>{message}</span>
                            </div>
                            {message.includes("successful") && (
                                <Link to="/login" className="message-link">
                                    Login now →
                                </Link>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="register-form">
                        {/* Name field */}
                        <div className="form-group">
                            <label htmlFor="register-name" className="form-label">
                                Full Name
                            </label>
                            <input
                                id="register-name"
                                className="form-input"
                                type="text"
                                name="name"
                                placeholder="Enter your full name"
                                value={formData.name}
                                onChange={handleChange}
                                autoComplete="name"
                                required
                            />
                        </div>

                        {/* Email field */}
                        <div className="form-group">
                            <label htmlFor="register-email" className="form-label">
                                Email Address
                            </label>
                            <input
                                id="register-email"
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
                            <label htmlFor="register-password" className="form-label">
                                Password
                            </label>
                            <div className="password-input-wrapper">
                                <input
                                    id="register-password"
                                    className="form-input"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="Create a password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    autoComplete="new-password"
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
                            className="btn-register-submit"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="btn-spinner" aria-hidden="true"></span>
                                    <span>Creating account...</span>
                                </>
                            ) : (
                                <span>Create Account</span>
                            )}
                        </button>
                    </form>

                    {/* Login Link */}
                    <div className="register-card-footer">
                        <span>Already have an account?</span>
                        <Link to="/login" className="register-login-link">
                            Login
                        </Link>
                    </div>
                </div>
            </div>

            {/* Optional Footer */}
            <footer className="register-page-footer">
                <span>Travel Alarm</span>
                <span className="footer-bullet" aria-hidden="true">•</span>
                <span>Your destination proximity assistant</span>
            </footer>
        </div>
    );
}

export default Register;