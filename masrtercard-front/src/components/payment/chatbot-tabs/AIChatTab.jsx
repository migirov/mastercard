import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/apiClient';
import { motion } from 'framer-motion';

const SUGGESTIONS = [
  'What are the current FX rates?',
  'How do I make a payment?',
  'What is the status of my invoices?',
  'How do I add a new supplier?',
];

function Message({ role, content }) {
  const isUser = role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-primary'
      }`}>
        {isUser
          ? <User className="w-4 h-4 text-primary-foreground" />
          : <Bot className="w-4 h-4 text-white" />
        }
      </div>
      <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-muted text-foreground rounded-tl-sm'
      }`}>
        {content}
      </div>
    </motion.div>
  );
}

export default function AIChatTab() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m the XBS smart assistant. I can help you with questions about payments, FX rates, invoice management, and more. How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    const history = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');

    let response;
    try {
      response = await api.integrations.Core.InvokeLLM({
        prompt: `You are the smart assistant for XBS Embedded — a cross-border payment platform embedded inside ERP systems.
You are friendly, professional, and respond in English.
Your role: answer questions about international payments, FX rates, invoice management, and KYB/RFI processes.

Conversation history:
${history}

User: ${userText}

Reply in English, concisely and clearly.`,
      });
    } catch {
      response = 'Sorry, I could not reach the assistant right now. Please try again.';
    } finally {
      setLoading(false);
    }

    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <Message key={i} role={msg.role} content={msg.content} />
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions (shown only at start) */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border bg-card/80 shrink-0">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-right"
            dir="ltr"
            disabled={loading}
          />
          <Button
            size="icon"
            className="h-7 w-7 shrink-0 rounded-lg"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">Powered by AI · XBS Embedded</p>
      </div>
    </div>
  );
}