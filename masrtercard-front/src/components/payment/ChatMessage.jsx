import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';

export default function ChatMessage({ role, content }) {
  const isAssistant = role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}
    >
      <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${
        isAssistant ? 'bg-primary/10' : 'bg-muted'
      }`}>
        {isAssistant ? (
          <Bot className="w-4 h-4 text-primary" />
        ) : (
          <User className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isAssistant
          ? 'bg-muted text-foreground rounded-tl-md'
          : 'bg-primary text-primary-foreground rounded-tr-md'
      }`}>
        {content}
      </div>
    </motion.div>
  );
}