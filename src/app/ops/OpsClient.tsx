"use client";

import { useState, useEffect } from "react";
import { ExclamationTriangleIcon, PencilIcon } from "@heroicons/react/24/outline";

type OpsQueueItem = {
  id: string;
  canonical_url: string | null;
  missing_title: boolean;
  missing_image: boolean;
  display_price_text: string | null;
  enrich_last_attempt_at: string | null;
};

type EditModalState = {
  itemId: string | null;
  canonicalUrl: string | null;
  title: string;
  image: string;
  price: string;
};

export default function OpsClient() {
  const [items, setItems] = useState<OpsQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<EditModalState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/ops/queue");
      if (!response.ok) {
        if (response.status === 403) {
          setError("Access denied. Your email is not in the ops allowlist.");
        } else {
          setError(`Failed to load queue: ${response.status}`);
        }
        return;
      }
      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editModal) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/ops/item/${editModal.itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_product_title: editModal.title.trim() || null,
          display_cover_image_url: editModal.image.trim() || null,
          display_price_text: editModal.price.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
      }

      // Reload queue
      await loadQueue();
      setEditModal(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function truncateUrl(url: string | null, maxLength = 60): string {
    if (!url) return "";
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + "...";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>Loading ops queue...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Ops Queue</h1>

        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No items in queue. All items are healthy!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-background-dark-light border border-border dark:border-border-dark rounded-lg p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {item.missing_title && (
                      <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0" title="Missing title" />
                    )}
                    {item.missing_image && (
                      <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 flex-shrink-0" title="Missing image" />
                    )}
                    <a
                      href={item.canonical_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                      onClick={(e) => {
                        if (!item.canonical_url) {
                          e.preventDefault();
                        }
                      }}
                    >
                      {truncateUrl(item.canonical_url)}
                    </a>
                  </div>
                </div>
                <button
                  onClick={() => {
                    // Fetch current item data to populate modal
                    setEditModal({
                      itemId: item.id,
                      canonicalUrl: item.canonical_url,
                      title: "",
                      image: "",
                      price: item.display_price_text || "",
                    });
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                >
                  <PencilIcon className="w-4 h-4" />
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Edit Modal */}
        {editModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-background-dark-light rounded-lg p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Edit Item</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">URL</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 break-all">{editModal.canonicalUrl}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={editModal.title}
                    onChange={(e) => setEditModal({ ...editModal, title: e.target.value })}
                    className="w-full px-3 py-2 border border-border dark:border-border-dark rounded bg-background-light dark:bg-background-dark text-primary dark:text-primary-dark"
                    placeholder="Product title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cover Image URL</label>
                  <input
                    type="url"
                    value={editModal.image}
                    onChange={(e) => setEditModal({ ...editModal, image: e.target.value })}
                    className="w-full px-3 py-2 border border-border dark:border-border-dark rounded bg-background-light dark:bg-background-dark text-primary dark:text-primary-dark"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price Text (optional)</label>
                  <input
                    type="text"
                    value={editModal.price}
                    onChange={(e) => setEditModal({ ...editModal, price: e.target.value })}
                    className="w-full px-3 py-2 border border-border dark:border-border-dark rounded bg-background-light dark:bg-background-dark text-primary dark:text-primary-dark"
                    placeholder="$99.99"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setEditModal(null)}
                  className="flex-1 px-4 py-2 border border-border dark:border-border-dark rounded hover:bg-gray-50 dark:hover:bg-background-dark"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
