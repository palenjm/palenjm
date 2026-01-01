import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Send, Bot, User, FileText } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function export default function ChatPage({ user, token, onLogout })FUNCNAMEexport default function ChatPage({ user, token, onLogout })() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm your document search assistant. Ask me anything about the documents in the system, and I'll find the most relevant ones for you.",
      documents: []
    }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input, documents: [] };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const response = await axios.post(
        `${API}/chat`,
        { message: input },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const assistantMessage = {
        role: "assistant",
        content: response.data.response,
        documents: response.data.documents || []
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error("Failed to get response. Please try again.");
      const errorMessage = {
        role: "assistant",
        content: "I'm sorry, I encountered an error while searching. Please try again.",
        documents: []
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col" data-testid="chat-page">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: 'Manrope' }}>
            Chat Assistant
          </h1>
          <p className="text-slate-600">Ask questions in natural language to find documents</p>
        </div>

        {/* Messages Container */}
        <Card className="flex-1 glass border-white/50 mb-4 overflow-hidden flex flex-col">
          <CardContent className="p-6 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <div className="space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  
                  <div className={`max-w-2xl ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
                    <div
                      className={`p-4 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-slate-200'
                      }`}
                      data-testid={`chat-message-${idx}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    
                    {msg.documents && msg.documents.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.documents.map((doc) => (
                          <Card
                            key={doc.id}
                            className="cursor-pointer hover:shadow-md transition-all border-slate-200"
                            onClick={() => navigate(`/document/${doc.id}`)}
                            data-testid={`chat-doc-${doc.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{doc.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {doc.document_type}
                                    </Badge>
                                    <Badge className="text-xs bg-green-100 text-green-800">
                                      {(doc.score * 100).toFixed(0)}% match
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              ))}
              
              {sending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* Input Form */}
        <Card className="glass border-white/50">
          <CardContent className="p-4">
            <form onSubmit={handleSend} className="flex gap-3">
              <Input
                placeholder="Ask a question... (e.g., 'Show me all memoranda from 2025')"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
                className="flex-1"
                data-testid="chat-input"
              />
              <Button
                type="submit"
                disabled={sending || !input.trim()}
                data-testid="chat-send-button"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
