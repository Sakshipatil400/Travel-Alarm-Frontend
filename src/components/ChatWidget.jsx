import { useState, useRef, useEffect } from "react";
import "./ChatWidget.css";

const PRESET_PROMPTS = [
    { label: "📍 Active trip status", query: "What is my current active trip status?" },
    { label: "🚨 How alarm works", query: "How does the travel proximity alarm work?" },
    { label: "📡 GPS troubleshooting", query: "Why is GPS not updating or showing an error?" },
    { label: "📏 Recommended alert distance", query: "What is the best alert distance to set?" },
    { label: "🔋 Battery saving tips", query: "How can I save battery during background GPS tracking?" }
];

function getAssistantResponse(query) {
    const q = query.toLowerCase();

    // Check active trip from localStorage
    if (q.includes("active trip") || q.includes("current trip") || q.includes("my trip")) {
        try {
            const savedTrip = localStorage.getItem("activeTrip");
            if (savedTrip) {
                const trip = JSON.parse(savedTrip);
                const dest =
                    trip.destination?.name ||
                    trip.destinationName ||
                    (typeof trip.destination === "string" ? trip.destination : null) ||
                    (trip.destinationId ? `Destination #${trip.destinationId}` : "Destination");

                return `📍 **Active Trip Found!**\n\n• **Destination:** ${dest}\n• **Alert Distance:** ${trip.alertDistanceKm} km\n• **Started At:** ${trip.startedAt || "Recently"}\n\nYou can view real-time tracking on the **Active Trip** page!`;
            } else {
                return "ℹ️ No active trip is currently running. You can create a new trip from the **Start Trip** page to begin GPS proximity monitoring.";
            }
        } catch {
            return "Unable to read active trip details right now. Please check the Active Trip page.";
        }
    }

    if (q.includes("alarm") || q.includes("how does") || q.includes("work")) {
        return "🚨 **How the Proximity Alarm Works:**\n\n1. When your trip begins, your browser tracks your GPS position via `watchPosition()`.\n2. Your live latitude & longitude are continuously checked against your destination.\n3. The moment your distance reaches or drops below your **Alert Distance** threshold, an audio alarm sounds immediately and tracking pauses to alert you.";
    }

    if (q.includes("gps") || q.includes("permission") || q.includes("not updating") || q.includes("location")) {
        return "📡 **GPS Troubleshooting Tips:**\n\n1. Ensure browser location permission is set to **'Allow'** for this site.\n2. On mobile/laptop, turn ON device Location / GPS in system settings.\n3. If updates pause, click **'Check Location Now'** on the Active Trip page for an instant GPS poll.\n4. Avoid incognito tabs if permissions reset automatically.";
    }

    if (q.includes("distance") || q.includes("threshold") || q.includes("best") || q.includes("recommend")) {
        return "📏 **Recommended Alert Distances:**\n\n• **High-speed train or express:** 5 km – 10 km (~5–10 mins to pack bags)\n• **City bus or metro:** 1 km – 2 km (1–2 stops prior)\n• **Flight / long commute:** 10 km – 15 km";
    }

    if (q.includes("battery") || q.includes("power") || q.includes("background")) {
        return "🔋 **Battery Conservation Tips:**\n\n• Keep your screen brightness moderate or let the screen sleep while the tab runs in background.\n• The proximity alarm triggers via browser Web Audio even with headphones connected.\n• Make sure the browser tab is kept active so GPS updates remain timely.";
    }

    if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
        return "👋 Hello! I am your **Travel Alarm Assistant**. How can I help with your trips, alert distances, or GPS tracking today?";
    }

    return `Thank you for asking! I'm here to assist with your travel alarm and GPS monitoring. You can check your **Active Trip status**, ask about **alert distance configurations**, or review **GPS troubleshooting** anytime.`;
}

function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const nextIdRef = useRef(2);
    const [messages, setMessages] = useState(() => [
        {
            id: 1,
            sender: "assistant",
            text: "👋 Hi! I'm your Travel Alarm Assistant. Ask me anything about your active trips, proximity alarms, or select a quick prompt below!",
            time: "Online"
        }
    ]);
    const [inputText, setInputText] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isTyping, isOpen]);

    const handleSendMessage = (textToSend) => {
        const text = (textToSend || inputText).trim();
        if (!text) return;

        const currentMsgId = nextIdRef.current;
        nextIdRef.current += 1;

        // User message
        const userMsg = {
            id: currentMsgId,
            sender: "user",
            text,
            time: "Just now"
        };

        setMessages((prev) => [...prev, userMsg]);
        if (!textToSend) {
            setInputText("");
        }

        // Assistant reply with slight typing delay
        setIsTyping(true);
        setTimeout(() => {
            const replyText = getAssistantResponse(text);
            const replyMsgId = nextIdRef.current;
            nextIdRef.current += 1;

            const assistantMsg = {
                id: replyMsgId,
                sender: "assistant",
                text: replyText,
                time: "Just now"
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setIsTyping(false);
        }, 600);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleClearChat = () => {
        const resetId = nextIdRef.current;
        nextIdRef.current += 1;

        setMessages([
            {
                id: resetId,
                sender: "assistant",
                text: "Chat cleared! How can I assist you with your journey today?",
                time: "Just now"
            }
        ]);
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                type="button"
                className={`chat-launcher-btn ${isOpen ? "is-open" : ""}`}
                onClick={() => setIsOpen((prev) => !prev)}
                title={isOpen ? "Close Assistant" : "Open Travel Assistant"}
                aria-label={isOpen ? "Close Chat" : "Open Chat"}
            >
                <span className="chat-launcher-icon">
                    {isOpen ? "✕" : "💬"}
                </span>
                {!isOpen && <span className="chat-launcher-badge"></span>}
            </button>

            {/* Popup Chatbox Window */}
            {isOpen && (
                <div
                    className="chat-popup-container"
                    role="dialog"
                    aria-label="Travel Assistant Chatbox"
                >
                    {/* Header */}
                    <div className="chat-header">
                        <div className="chat-header-title-wrap">
                            <div className="chat-avatar" aria-hidden="true">
                                🤖
                            </div>
                            <div className="chat-title-info">
                                <h3 className="chat-title">Travel Assistant</h3>
                                <span className="chat-status-sub">
                                    <span className="chat-status-dot"></span>
                                    Online • Quick Prompts
                                </span>
                            </div>
                        </div>
                        <div className="chat-header-actions">
                            <button
                                type="button"
                                className="chat-header-btn"
                                onClick={handleClearChat}
                                title="Clear conversation"
                                aria-label="Clear chat"
                            >
                                🔄
                            </button>
                            <button
                                type="button"
                                className="chat-header-btn"
                                onClick={() => setIsOpen(false)}
                                title="Close chat"
                                aria-label="Close chat"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Quick Prompts Bar */}
                    <div className="chat-prompts-bar">
                        {PRESET_PROMPTS.map((prompt, idx) => (
                            <button
                                key={idx}
                                type="button"
                                className="chat-prompt-chip"
                                onClick={() => handleSendMessage(prompt.query)}
                            >
                                {prompt.label}
                            </button>
                        ))}
                    </div>

                    {/* Messages Area */}
                    <div className="chat-messages-area">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`chat-message-row ${msg.sender}`}
                            >
                                <div className="chat-bubble">
                                    {msg.text.split("\n").map((line, lIdx) => (
                                        <span key={lIdx}>
                                            {line}
                                            <br />
                                        </span>
                                    ))}
                                </div>
                                <span className="chat-time">{msg.time}</span>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isTyping && (
                            <div className="chat-message-row assistant">
                                <div className="chat-typing-bubble">
                                    <span className="typing-dot"></span>
                                    <span className="typing-dot"></span>
                                    <span className="typing-dot"></span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Form */}
                    <form
                        className="chat-input-form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSendMessage();
                        }}
                    >
                        <input
                            type="text"
                            className="chat-input-field"
                            placeholder="Type a question or pick a prompt..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button
                            type="submit"
                            className="chat-send-btn"
                            disabled={!inputText.trim() || isTyping}
                            title="Send message"
                            aria-label="Send"
                        >
                            ➤
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}

export default ChatWidget;
