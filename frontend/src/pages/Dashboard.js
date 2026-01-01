import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { FileText, Upload, Search, MessageSquare, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [userRes, statsRes, docsRes] = await Promise.all([
        axios.get(`${API}/auth/me`, { withCredentials: true }),
        axios.get(`${API}/stats`, { withCredentials: true }),
        axios.get(`${API}/documents`, { withCredentials: true })
      ]);
      
      setUser(userRes.data);
      setStats(statsRes.data);
      setRecentDocs(docsRes.data.slice(0, 5));
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/';
    }
  };

  const statCards = [
    {
      title: "Total Documents",
      value: stats?.total_documents || 0,
      icon: FileText,
      color: "bg-blue-500",
      testId: "total-docs-stat"
    },
    {
      title: "Your Documents",
      value: stats?.your_documents || 0,
      icon: Upload,
      color: "bg-green-500",
      testId: "your-docs-stat"
    },
    {
      title: "Public Documents",
      value: stats?.public_documents || 0,
      icon: TrendingUp,
      color: "bg-purple-500",
      testId: "public-docs-stat"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar user={user} onLogout={handleLogout} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="dashboard-container">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: 'Manrope' }}>
            Welcome back, {user?.name}!
          </h1>
          <p className="text-slate-600">Manage and search institutional documents with AI-powered semantic search</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="glass border-white/50 hover:shadow-xl transition-all" data-testid={stat.testId}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold" style={{ fontFamily: 'Manrope' }}>
                        {loading ? "..." : stat.value}
                      </p>
                    </div>
                    <div className={`${stat.color} w-14 h-14 rounded-2xl flex items-center justify-center`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="glass border-white/50 hover:shadow-xl transition-all cursor-pointer" onClick={() => navigate('/search')} data-testid="search-action-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Search className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Manrope' }}>Advanced Search</h3>
                  <p className="text-slate-600 text-sm">Use BM25, semantic, or hybrid search to find documents quickly</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/50 hover:shadow-xl transition-all cursor-pointer" onClick={() => navigate('/chat')} data-testid="chat-action-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Manrope' }}>Chat Interface</h3>
                  <p className="text-slate-600 text-sm">Ask questions in natural language and get instant results</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Documents */}
        <Card className="glass border-white/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle style={{ fontFamily: 'Manrope' }}>Recent Documents</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/upload')} data-testid="upload-document-button">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-slate-500 text-center py-8">Loading documents...</p>
            ) : recentDocs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">No documents yet</p>
                <Button onClick={() => navigate('/upload')} data-testid="empty-upload-button">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Document
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 transition-all cursor-pointer border border-slate-200"
                    onClick={() => navigate(`/document/${doc.id}`)}
                    data-testid={`recent-doc-${doc.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-sm text-slate-500">{doc.document_type} • {doc.access_level}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
