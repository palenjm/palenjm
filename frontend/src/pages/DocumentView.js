import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { ArrowLeft, FileText, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DocumentView({ user, token, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    try {
      const response = await axios.get(`${API}/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocument(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load document");
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Document deleted successfully");
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete document");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navbar user={user} onLogout={onLogout} />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600">Loading document...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!document) return null;

  const isOwner = document.uploaded_by === user?.user_id;
  const canDownload = document.access_level === 'Public' || isOwner || user?.role === 'Admin';

  const handleDownload = async () => {
    try {
      const response = await axios.get(`${API}/documents/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', document.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Document downloaded successfully");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to download document");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar user={user} onLogout={onLogout} />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="document-view">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
            data-testid="back-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: 'Manrope' }}>
                {document.title}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{document.document_type}</Badge>
                <Badge variant="outline">{document.access_level}</Badge>
                <span className="text-sm text-slate-500">
                  Uploaded on {new Date(document.uploaded_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              {canDownload && (
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  data-testid="download-document-button"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}
              {isOwner && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid="delete-document-button"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Document Info */}
        <Card className="glass border-white/50 mb-6">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Manrope' }}>Document Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-500">File Name</p>
                <p className="font-medium">{document.file_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Content */}
        <Card className="glass border-white/50">
          <CardHeader>
            <CardTitle style={{ fontFamily: 'Manrope' }}>Document Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700 bg-slate-50 p-6 rounded-lg">
                {document.content}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-button"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
