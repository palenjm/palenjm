import { useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Upload, FileText, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UploadPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    document_type: "Memorandum",
    access_level: "Public"
  });

  const documentTypes = [
    "Memorandum",
    "BOR Resolution",
    "MOU",
    "Proposal Template",
    "Leave Form",
    "Office Order",
    "Policy",
    "Circular",
    "Official Communication",
    "Other"
  ];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error("Please upload a PDF, DOCX, or TXT file");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploading(true);

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('title', formData.title);
      uploadData.append('document_type', formData.document_type);
      uploadData.append('access_level', formData.access_level);

      await axios.post(`${API}/documents/upload`, uploadData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success("Document uploaded successfully!");
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="upload-page">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: 'Manrope' }}>
            Upload Document
          </h1>
          <p className="text-slate-600">Add a new document to the DMRS repository</p>
        </div>

        <Card className="glass border-white/50">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Manrope' }}>Document Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Document Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Faculty Meeting Minutes - January 2025"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  data-testid="document-title-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_type">Document Type</Label>
                <Select
                  value={formData.document_type}
                  onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                >
                  <SelectTrigger id="document_type" data-testid="document-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access_level">Access Level</Label>
                <Select
                  value={formData.access_level}
                  onValueChange={(value) => setFormData({ ...formData, access_level: value })}
                >
                  <SelectTrigger id="access_level" data-testid="access-level-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Public">Public - Accessible to all users</SelectItem>
                    <SelectItem value="Restricted">Restricted - Only you can access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">File Upload</Label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  <input
                    id="file"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="file-input"
                  />
                  <label htmlFor="file" className="cursor-pointer">
                    {file ? (
                      <div className="flex items-center justify-center gap-3 text-green-600">
                        <CheckCircle className="w-8 h-8" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-600 font-medium mb-1">Click to upload a file</p>
                        <p className="text-sm text-slate-500">PDF, DOCX, or TXT (Max 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1"
                  data-testid="cancel-upload-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={uploading}
                  className="flex-1"
                  data-testid="submit-upload-button"
                >
                  {uploading ? "Uploading..." : "Upload Document"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-700">
              <p className="font-medium mb-1">Supported Document Types</p>
              <p className="text-slate-600">The system supports official university documents including memoranda, BOR resolutions, MOUs, policies, circulars, and more. Documents are processed using AI to enable semantic search capabilities.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
