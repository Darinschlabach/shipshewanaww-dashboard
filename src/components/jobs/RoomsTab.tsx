"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import type { Room } from "@/lib/types";
import Button from "@/components/Button";
import Modal from "@/components/Modal";

interface RoomsTabProps {
  jobId: string;
}

type RoomFormState = {
  name: string;
  wood_species: string;
  door_style: string;
  finish_type: "Painted" | "Stained";
  finish_color: string;
  notes: string;
};

const EMPTY_ROOM_FORM: RoomFormState = {
  name: "",
  wood_species: "",
  door_style: "",
  finish_type: "Painted",
  finish_color: "",
  notes: "",
};

export default function RoomsTab({ jobId }: RoomsTabProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showRoomDetail, setShowRoomDetail] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [savingRoom, setSavingRoom] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState<RoomFormState>(EMPTY_ROOM_FORM);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });
    setRooms((data as Room[]) ?? []);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const roomCountLabel = useMemo(() => {
    const count = rooms.length;
    return `${count} room${count === 1 ? "" : "s"}`;
  }, [rooms]);

  function openCreateRoomModal() {
    setEditingRoom(null);
    setRoomForm(EMPTY_ROOM_FORM);
    setShowRoomForm(true);
  }

  function openEditRoomModal(room: Room) {
    setEditingRoom(room);
    setRoomForm({
      name: room.name,
      wood_species: room.wood_species ?? "",
      door_style: room.door_style ?? "",
      finish_type: room.finish_type ?? "Painted",
      finish_color: room.finish_color ?? "",
      notes: room.notes ?? "",
    });
    setShowRoomForm(true);
  }

  function openRoomDetail(room: Room) {
    setSelectedRoom(room);
    setShowRoomDetail(true);
  }

  async function handleSaveRoom(e: FormEvent) {
    e.preventDefault();
    if (!roomForm.name.trim()) return;

    setSavingRoom(true);
    const supabase = createClient();

    if (editingRoom) {
      await supabase
        .from("rooms")
        .update({
          name: roomForm.name.trim(),
          wood_species: roomForm.wood_species.trim() || null,
          door_style: roomForm.door_style.trim() || null,
          finish_type: roomForm.finish_type,
          finish_color: roomForm.finish_color.trim() || null,
          notes: roomForm.notes.trim() || null,
        })
        .eq("id", editingRoom.id);
    } else {
      await supabase.from("rooms").insert({
        job_id: jobId,
        name: roomForm.name.trim(),
        wood_species: roomForm.wood_species.trim() || null,
        door_style: roomForm.door_style.trim() || null,
        finish_type: roomForm.finish_type,
        finish_color: roomForm.finish_color.trim() || null,
        notes: roomForm.notes.trim() || null,
      });
    }

    setSavingRoom(false);
    setShowRoomForm(false);
    setEditingRoom(null);
    setRoomForm(EMPTY_ROOM_FORM);
    await loadRooms();
  }

  async function handleDeleteRoom(room: Room) {
    if (!confirm(`Delete room "${room.name}"? This cannot be undone.`)) return;

    setDeletingRoomId(room.id);
    const supabase = createClient();
    await supabase.from("rooms").delete().eq("id", room.id);
    setDeletingRoomId(null);

    if (selectedRoom?.id === room.id) {
      setSelectedRoom(null);
      setShowRoomDetail(false);
    }

    await loadRooms();
  }

  function displaySpecValue(value: string | null, isItalicWhenEmpty = true) {
    if (value && value.trim()) {
      return <span className="font-semibold text-gray-900">{value}</span>;
    }

    return (
      <span
        className={`${isItalicWhenEmpty ? "italic" : ""} font-semibold text-gray-400`}
      >
        TBD
      </span>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Job Specs ({roomCountLabel})</h2>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading rooms...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const hasCompleteSpecs = !!(
              room.wood_species?.trim() &&
              room.door_style?.trim() &&
              room.finish_type?.trim() &&
              room.finish_color?.trim()
            );
            const finishValue =
              room.finish_type?.trim() && room.finish_color?.trim()
                ? `${room.finish_type} · ${room.finish_color}`
                : null;

            return (
              <button
                key={room.id}
                type="button"
                className="group flex min-h-[162px] w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md"
                onClick={() => openRoomDetail(room)}
              >
                <div
                  className={`flex h-full border-l-6 ${
                    hasCompleteSpecs ? "border-burgundy" : "border-gray-300"
                  }`}
                >
                  <div className="flex w-full flex-col p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="text-xl font-semibold text-gray-900">{room.name}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Edit ${room.name}`}
                          className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-burgundy"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditRoomModal(room);
                          }}
                        >
                          <IconPencil size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${room.name}`}
                          className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-red-600"
                          disabled={deletingRoomId === room.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(room);
                          }}
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-base">
                      <div className="flex items-start justify-between gap-2 border-b border-gray-200 pb-1.5">
                        <span className="text-gray-800">Species</span>
                        {displaySpecValue(room.wood_species)}
                      </div>
                      <div className="flex items-start justify-between gap-2 border-b border-gray-200 pb-1.5">
                        <span className="text-gray-800">Door style</span>
                        {displaySpecValue(room.door_style)}
                      </div>
                      <div className="flex items-start justify-between gap-2 border-b border-gray-200 pb-1.5">
                        <span className="text-gray-800">Finish</span>
                        {finishValue ? (
                          <span className="text-right font-semibold text-gray-900">
                            {finishValue}
                          </span>
                        ) : (
                          <span className="italic font-semibold text-gray-400">TBD</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-3 text-base">
                      <span className="max-w-[70%] truncate text-gray-800">
                        {room.notes?.trim() || "No notes yet"}
                      </span>
                      <span className="font-semibold text-burgundy">View →</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={openCreateRoomModal}
            className="flex min-h-[162px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-xl font-medium text-gray-700 transition hover:border-burgundy hover:text-burgundy"
          >
            <span className="inline-flex items-center gap-2">+ Add room</span>
          </button>
        </div>
      )}

      {showRoomForm && (
        <Modal title={editingRoom ? "Edit room" : "Add room"} onClose={() => setShowRoomForm(false)}>
          <form onSubmit={handleSaveRoom} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Room name</label>
              <input
                required
                value={roomForm.name}
                onChange={(e) => setRoomForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Wood species</label>
              <input
                value={roomForm.wood_species}
                onChange={(e) =>
                  setRoomForm((prev) => ({ ...prev, wood_species: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Door style</label>
              <input
                value={roomForm.door_style}
                onChange={(e) =>
                  setRoomForm((prev) => ({ ...prev, door_style: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Finish type</label>
              <select
                value={roomForm.finish_type}
                onChange={(e) =>
                  setRoomForm((prev) => ({
                    ...prev,
                    finish_type: e.target.value as "Painted" | "Stained",
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="Painted">Painted</option>
                <option value="Stained">Stained</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Finish color</label>
              <input
                value={roomForm.finish_color}
                onChange={(e) =>
                  setRoomForm((prev) => ({ ...prev, finish_color: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                rows={3}
                value={roomForm.notes}
                onChange={(e) => setRoomForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={() => setShowRoomForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingRoom}>
                {savingRoom ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showRoomDetail && selectedRoom && (
        <Modal title={selectedRoom.name} onClose={() => setShowRoomDetail(false)}>
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="text-gray-500">Wood species</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.wood_species?.trim() || "TBD"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="text-gray-500">Door style</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.door_style?.trim() || "TBD"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="text-gray-500">Finish type</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.finish_type?.trim() || "TBD"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Finish color</dt>
                  <dd className="font-semibold text-gray-900">
                    {selectedRoom.finish_color?.trim() || "TBD"}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-medium text-gray-900">Notes</h3>
              <p className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                {selectedRoom.notes?.trim() || "No notes yet"}
              </p>
            </div>

            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Additional room properties coming soon
            </p>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => {
                  setShowRoomDetail(false);
                  openEditRoomModal(selectedRoom);
                }}
              >
                Edit room
              </Button>
              <Button type="button" variant="primary" onClick={() => setShowRoomDetail(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
