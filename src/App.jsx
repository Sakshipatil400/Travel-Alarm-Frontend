import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Destinations from "./pages/Destinations";
import StartTrip from "./pages/StartTrip";
import ActiveTrip from "./pages/ActiveTrip";
import TripHistory from "./pages/TripHistory";
import ChatWidget from "./components/ChatWidget";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/destinations" element={<Destinations />} />
                <Route path="/start-trip" element={<StartTrip />} />
                <Route path="/active-trip" element={<ActiveTrip />} />
                <Route path="/trip-history" element={<TripHistory />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            <ChatWidget />
        </BrowserRouter>
    );
}

export default App;