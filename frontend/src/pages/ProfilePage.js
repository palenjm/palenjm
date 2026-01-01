import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import { User, Save } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    designation: ""
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
      setFormData({
        name: response.data.name || "",
        designation: response.data.designation || ""
      });
    } catch (error) {
      toast.error("Failed to load profile");
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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await axios.put(
        `${API}/profile`,
        formData,
        { withCredentials: true }
      );
      setUser(response.data);
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navbar user={user} onLogout={handleLogout} />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="profile-page">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: 'Manrope' }}>
            Profile Settings
          </h1>
          <p className="text-slate-600">Update your personal information</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile Picture Card */}
          <Card className="glass border-white/50">
            <CardContent className="p-6">
              <div className="text-center">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <User className="w-16 h-16 text-white" />
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1" style={{ fontFamily: 'Manrope' }}>
                  {user?.name}
                </h3>
                <p className="text-sm text-slate-500 mb-2">{user?.email}</p>
                <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {user?.role}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card className="glass border-white/50 md:col-span-2">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Manrope' }}>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your full name"
                    required
                    data-testid="profile-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    value={user?.email}
                    disabled
                    className="bg-slate-100"
                  />
                  <p className="text-xs text-slate-500">Email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="designation">Designation</Label>
                  <Input
                    id="designation"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g., Professor, Assistant Dean, Researcher"
                    data-testid="profile-designation-input"
                  />
                  <p className="text-xs text-slate-500">Your position or title at NEMSU</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={user?.role}
                    disabled
                    className="bg-slate-100"
                  />
                  <p className="text-xs text-slate-500">Role is managed by administrators</p>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1"
                    data-testid="save-profile-button"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
