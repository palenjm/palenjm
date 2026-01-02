import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Navbar from "@/components/Navbar";
import { Shield, Users, FileText, Trash2, Edit, Plus, Settings } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showAddTypeDialog, setShowAddTypeDialog] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [userRes, usersRes, docsRes, typesRes] = await Promise.all([
        axios.get(`${API}/auth/me`, { withCredentials: true }),
        axios.get(`${API}/admin/users`, { withCredentials: true }),
        axios.get(`${API}/admin/documents`, { withCredentials: true }),
        axios.get(`${API}/admin/document-types`, { withCredentials: true })
      ]);

      setUser(userRes.data);
      setUsers(usersRes.data);
      setDocuments(docsRes.data);
      setDocumentTypes(typesRes.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error("Admin access required");
        window.location.href = "/dashboard";
      } else {
        toast.error("Failed to load admin data");
      }
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
    }
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      await axios.put(
        `${API}/admin/users/${userId}`,
        updates,
        { withCredentials: true }
      );
      toast.success("User updated successfully");
      fetchData();
      setEditingUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update user");
    }
  };

  const handleDeleteUser = async () => {
    try {
      await axios.delete(
        `${API}/admin/users/${deleteTarget}`,
        { withCredentials: true }
      );
      toast.success("User deleted successfully");
      fetchData();
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await axios.delete(
        `${API}/documents/${docId}`,
        { withCredentials: true }
      );
      toast.success("Document deleted successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete document");
    }
  };

  const handleAddDocumentType = async () => {
    if (!newTypeName.trim()) {
      toast.error("Please enter a document type name");
      return;
    }

    try {
      await axios.post(
        `${API}/admin/document-types`,
        { name: newTypeName },
        { withCredentials: true }
      );
      toast.success("Document type added successfully");
      setNewTypeName("");
      setShowAddTypeDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add document type");
    }
  };

  const handleDeleteDocumentType = async (typeName) => {
    try {
      await axios.delete(
        `${API}/admin/document-types/${encodeURIComponent(typeName)}`,
        { withCredentials: true }
      );
      toast.success("Document type deleted successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete document type");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navbar user={user} onLogout={handleLogout} />
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="admin-panel">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: 'Manrope' }}>
              Admin Panel
            </h1>
          </div>
          <p className="text-slate-600">Complete system management and control</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="glass border-white/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Users</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Manrope' }}>
                    {users.length}
                  </p>
                </div>
                <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Documents</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Manrope' }}>
                    {documents.length}
                  </p>
                </div>
                <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center">
                  <FileText className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Public Documents</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Manrope' }}>
                    {documents.filter(d => d.access_level === 'Public').length}
                  </p>
                </div>
                <div className="w-14 h-14 bg-purple-500 rounded-2xl flex items-center justify-center">
                  <FileText className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Document Types</p>
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Manrope' }}>
                    {documentTypes.length}
                  </p>
                </div>
                <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center">
                  <Settings className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <Button
            variant={activeTab === "users" ? "default" : "outline"}
            onClick={() => setActiveTab("users")}
            data-testid="admin-users-tab"
          >
            <Users className="w-4 h-4 mr-2" />
            Users
          </Button>
          <Button
            variant={activeTab === "documents" ? "default" : "outline"}
            onClick={() => setActiveTab("documents")}
            data-testid="admin-documents-tab"
          >
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </Button>
          <Button
            variant={activeTab === "types" ? "default" : "outline"}
            onClick={() => setActiveTab("types")}
            data-testid="admin-types-tab"
          >
            <Settings className="w-4 h-4 mr-2" />
            Document Types
          </Button>
        </div>

        {/* Users Table */}
        {activeTab === "users" && (
          <Card className="glass border-white/50">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Manrope' }}>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          {editingUser === u.user_id ? (
                            <Select
                              defaultValue={u.role}
                              onValueChange={(value) => handleUpdateUser(u.user_id, { role: value })}
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Faculty">Faculty</SelectItem>
                                <SelectItem value="Administrative">Administrative</SelectItem>
                                <SelectItem value="Admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge>{u.role}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{u.designation || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingUser(editingUser === u.user_id ? null : u.user_id)}
                              data-testid={`edit-user-${u.user_id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {u.user_id !== user.user_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteTarget(u.user_id)}
                                className="text-red-600"
                                data-testid={`delete-user-${u.user_id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents Table */}
        {activeTab === "documents" && (
          <Card className="glass border-white/50">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Manrope' }}>Document Management (Full Access)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Access Level</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell>{doc.document_type}</TableCell>
                        <TableCell>
                          <Badge variant={doc.access_level === 'Public' ? 'default' : 'secondary'}>
                            {doc.access_level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-600"
                            data-testid={`delete-doc-${doc.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Types Management */}
        {activeTab === "types" && (
          <Card className="glass border-white/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle style={{ fontFamily: 'Manrope' }}>Document Type Management</CardTitle>
                <Button onClick={() => setShowAddTypeDialog(true)} data-testid="add-type-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Type
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documentTypes.map((type) => (
                  <Card key={type.name} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <span className="font-medium">{type.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteDocumentType(type.name)}
                          className="text-red-600"
                          data-testid={`delete-type-${type.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Document Type Dialog */}
      <Dialog open={showAddTypeDialog} onOpenChange={setShowAddTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document Type</DialogTitle>
            <DialogDescription>
              Create a new document type for the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type-name">Document Type Name</Label>
              <Input
                id="type-name"
                placeholder="e.g., Research Paper, Certificate, Report"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                data-testid="new-type-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTypeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDocumentType} data-testid="confirm-add-type">
              Add Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
