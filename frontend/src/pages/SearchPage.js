import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Search, FileText, Zap, Brain, Blend } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SearchPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState("hybrid");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user');
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const searchModes = [
    { value: "bm25", label: "BM25", icon: Zap, description: "Traditional keyword-based search", color: "bg-orange-500" },
    { value: "semantic", label: "Semantic", icon: Brain, description: "AI-powered meaning-based search", color: "bg-purple-500" },
    { value: "hybrid", label: "Hybrid", icon: Blend, description: "Best of both worlds", color: "bg-blue-500" }
  ];

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setSearching(true);
    setHasSearched(true);

    try {
      const response = await axios.post(
        `${API}/search`,
        { query, search_mode: searchMode },
        { withCredentials: true }
      );
      
      setResults(response.data);
      
      if (response.data.length === 0) {
        toast.info("No documents found matching your query");
      } else {
        toast.success(`Found ${response.data.length} relevant documents`);
      }
    } catch (error) {
      toast.error("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 0.7) return "bg-green-100 text-green-800";
    if (score >= 0.4) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  const currentMode = searchModes.find(m => m.value === searchMode);
  const ModeIcon = currentMode?.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar user={user} onLogout={handleLogout} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="search-page">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: 'Manrope' }}>
            Advanced Search
          </h1>
          <p className="text-slate-600">Search documents using multiple retrieval algorithms</p>
        </div>

        {/* Search Modes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {searchModes.map((mode) => {
            const Icon = mode.icon;
            const isActive = searchMode === mode.value;
            return (
              <Card
                key={mode.value}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isActive ? 'ring-2 ring-blue-500 glass' : 'glass border-white/50'
                }`}
                onClick={() => setSearchMode(mode.value)}
                data-testid={`search-mode-${mode.value}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`${mode.color} w-10 h-10 rounded-lg flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold" style={{ fontFamily: 'Manrope' }}>{mode.label}</p>
                      <p className="text-xs text-slate-500">{mode.description}</p>
                    </div>
                    {isActive && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search Bar */}
        <Card className="glass border-white/50 mb-8">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search for documents... (e.g., 'faculty meeting minutes' or 'leave application form')"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 h-12"
                  data-testid="search-query-input"
                />
              </div>
              <Button
                type="submit"
                disabled={searching}
                className="h-12 px-8"
                data-testid="search-submit-button"
              >
                {searching ? "Searching..." : "Search"}
              </Button>
            </form>
            
            {currentMode && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <ModeIcon className="w-4 h-4" />
                <span>Using <strong>{currentMode.label}</strong> search mode</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <div>
          {searching ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-600">Searching documents...</p>
            </div>
          ) : hasSearched && results.length === 0 ? (
            <Card className="glass border-white/50">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-600 mb-2">No documents found</p>
                <p className="text-sm text-slate-500">Try different keywords or search modes</p>
              </CardContent>
            </Card>
          ) : results.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold" style={{ fontFamily: 'Manrope' }}>
                  Search Results ({results.length})
                </h2>
              </div>
              
              {results.map((doc) => (
                <Card
                  key={doc.id}
                  className="glass border-white/50 hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => navigate(`/document/${doc.id}`)}
                  data-testid={`search-result-${doc.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Manrope' }}>
                            {doc.title}
                          </h3>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {doc.document_type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {doc.access_level}
                            </Badge>
                            <Badge className={`text-xs ${getScoreColor(doc.score)}`}>
                              {(doc.score * 100).toFixed(0)}% match
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-2">{doc.snippet}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      Uploaded on {new Date(doc.uploaded_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass border-white/50">
              <CardContent className="p-12 text-center">
                <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-600 mb-2">Start Your Search</p>
                <p className="text-sm text-slate-500">Enter keywords or questions to find relevant documents</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
