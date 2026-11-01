import React, { useEffect, useMemo, useState } from 'react';
import { GuestRecord, SeatingTable } from '../types/planning';
import {
  SeatingSummaryMetrics,
  generateGuestSeatingQrPass,
} from '../utils/planningLogic';
import {
  X,
  UserPlus,
  Check,
  AlertCircle,
  QrCode,
  Smartphone,
  Copy,
  MapPin,
  Share2,
  Navigation,
} from 'lucide-react';
import { CustomSelectPopover } from './CustomSelectPopover';

interface SeatingAndRsvpModalProps {
  isOpen: boolean;
  onClose: () => void;
  guests: GuestRecord[];
  tables: SeatingTable[];
  seatingMetrics: SeatingSummaryMetrics;
  selectedTableNumber: number | null;
  eventName?: string;
  venueName?: string;
  initialTab?: 'roster' | 'share-qr';
  initialShareGuestId?: string | null;
  onAssignGuest: (guestId: string, tableNumber: number | null) => { ok: boolean; error?: string };
  onAddGuest: (guest: Omit<GuestRecord, 'id'>) => void;
  onUpdateRsvpStatus: (guestId: string, status: GuestRecord['rsvpStatus']) => void;
}

export const SeatingAndRsvpModal: React.FC<SeatingAndRsvpModalProps> = ({
  isOpen,
  onClose,
  guests,
  tables,
  seatingMetrics,
  selectedTableNumber,
  eventName = 'Sample: Aarav & Diya — Udaipur Courtyard Wedding',
  venueName = 'Suryagarh Heritage Courtyard & Glass Pavilion',
  initialTab = 'roster',
  initialShareGuestId = null,
  onAssignGuest,
  onAddGuest,
  onUpdateRsvpStatus,
}) => {
  const [activeModalTab, setActiveModalTab] = useState<'roster' | 'share-qr'>(initialTab);
  const [selectedQrGuestId, setSelectedQrGuestId] = useState<string>(
    initialShareGuestId || guests[0]?.id || ''
  );
  const [copiedGuestId, setCopiedGuestId] = useState<string | null>(null);
  const [mobileScanSimulated, setMobileScanSimulated] = useState<boolean>(false);

  const [filterRsvp, setFilterRsvp] = useState<'All' | GuestRecord['rsvpStatus']>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPlusOnes, setNewPlusOnes] = useState(0);
  const [newDietary, setNewDietary] = useState<GuestRecord['dietary']>('Standard');
  const [newRole, setNewRole] = useState('VIP Guest');
  const [newTableNumber, setNewTableNumber] = useState<number | null>(selectedTableNumber || 1);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      setActiveModalTab(initialTab);
      if (initialShareGuestId) {
        setSelectedQrGuestId(initialShareGuestId);
        setMobileScanSimulated(true);
      } else if (!selectedQrGuestId && guests.length > 0) {
        setSelectedQrGuestId(guests[0].id);
      }
    }
  }, [isOpen, initialTab, initialShareGuestId, guests]);

  const activeQrGuest = useMemo(
    () => guests.find((g) => g.id === selectedQrGuestId) || guests[0] || null,
    [guests, selectedQrGuestId]
  );

  const activeQrPass = useMemo(() => {
    if (!activeQrGuest) return null;
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://aura-atelier.app';
    return generateGuestSeatingQrPass(activeQrGuest, tables, eventName, venueName, origin);
  }, [activeQrGuest, tables, eventName, venueName]);

  if (!isOpen) return null;

  const filteredGuests = guests.filter((g) => {
    const matchesStatus = filterRsvp === 'All' || g.rsvpStatus === filterRsvp;
    const matchesQuery =
      !searchQuery.trim() ||
      g.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.dietary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const handleCreateGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim()) {
      setFeedbackMsg({
        type: 'error',
        text: 'Please provide both guest full name and email address.',
      });
      return;
    }

    onAddGuest({
      fullName: newFullName.trim(),
      email: newEmail.trim(),
      rsvpStatus: 'Confirmed',
      plusOnes: Math.max(0, Number(newPlusOnes) || 0),
      dietary: newDietary,
      tableNumber: newTableNumber,
      role: newRole.trim() || 'Guest',
    });

    setNewFullName('');
    setNewEmail('');
    setNewPlusOnes(0);
    setFeedbackMsg({
      type: 'success',
      text: `Added ${newFullName.trim()} to the guest RSVP roster.`,
    });
  };

  const handleSeatChange = (guestId: string, rawVal: string) => {
    const targetTable = rawVal === 'unassigned' ? null : Number(rawVal);
    const res = onAssignGuest(guestId, targetTable);
    if (!res.ok && res.error) {
      setFeedbackMsg({ type: 'error', text: res.error });
    } else {
      setFeedbackMsg({
        type: 'success',
        text: targetTable
          ? `Updated seating assignment to Table 0${targetTable}.`
          : 'Moved guest to unassigned waiting list.',
      });
    }
  };

  const handleCopyShareUrl = async () => {
    if (!activeQrPass) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(activeQrPass.shareUrl);
      }
    } catch {
      // Fallback if clipboard API is restricted in iframe
    }
    setCopiedGuestId(activeQrPass.guestId);
    setTimeout(() => setCopiedGuestId(null), 2500);
  };

  const assignedPin = activeQrPass?.mapPins.find((p) => p.isAssignedTable) || null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/75 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rsvp-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden my-8">
        {/* Modal Header with Tab Switcher (Roster vs Share Seating QR) */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 id="rsvp-modal-title" className="text-xl font-bold text-slate-900 font-display">
              Guest RSVP Portal & Share Seating QR Passes
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Confirmed Headcount: <span className="font-mono font-semibold">{seatingMetrics.confirmedGuests}</span> ·
              Pending: <span className="font-mono font-semibold">{seatingMetrics.pendingGuests}</span> ·
              Seated: <span className="font-mono font-semibold">{seatingMetrics.seatedHeadcount}</span> ·
              Unassigned: <span className="font-mono font-semibold">{seatingMetrics.unassignedHeadcount}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg text-xs">
              <button
                type="button"
                data-testid="tab-guest-roster"
                onClick={() => setActiveModalTab('roster')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  activeModalTab === 'roster'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                1. Guest Roster & Seating
              </button>
              <button
                type="button"
                data-testid="tab-share-seating"
                onClick={() => setActiveModalTab('share-qr')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'share-qr'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>2. Share Seating (Guest QR & Zone Map)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close RSVP and Seating Portal"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TAB 1: GUEST ROSTER & TABLE ASSIGNMENT MATRIX */}
        {activeModalTab === 'roster' && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[78vh] overflow-y-auto">
            {/* Left Column: Add Guest RSVP Form & Table Capacity Overview */}
            <div className="lg:col-span-4 space-y-6">
              <form
                onSubmit={handleCreateGuest}
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
              >
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-slate-700" />
                  <span>Log Guest RSVP & Seat</span>
                </h3>

                <div>
                  <label htmlFor="guest-name-input" className="block text-xs font-medium text-slate-700 mb-1">
                    Guest / Party Name *
                  </label>
                  <input
                    id="guest-name-input"
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="e.g., Dr. Nadia Chen"
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="guest-email-input" className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    id="guest-email-input"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nadia.chen@example.com"
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="guest-plusones-input" className="block text-xs font-medium text-slate-700 mb-1">
                      Additional (+1s)
                    </label>
                    <input
                      id="guest-plusones-input"
                      type="number"
                      min={0}
                      max={5}
                      value={newPlusOnes}
                      onChange={(e) => setNewPlusOnes(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-700 mb-1">
                      Dietary Profile
                    </span>
                    <CustomSelectPopover
                      id="guest-dietary-select"
                      ariaLabel="Dietary Profile"
                      variant="light"
                      className="w-full"
                      value={newDietary}
                      onChange={(val) => setNewDietary(val as GuestRecord['dietary'])}
                      options={[
                        { value: 'Standard', label: 'Standard' },
                        { value: 'Vegan', label: 'Vegan' },
                        { value: 'Gluten-Free', label: 'Gluten-Free' },
                        { value: 'Nut-Free', label: 'Nut-Free' },
                        { value: 'Halal/Kosher', label: 'Halal/Kosher' },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="guest-role-input" className="block text-xs font-medium text-slate-700 mb-1">
                      Relationship / Group
                    </label>
                    <input
                      id="guest-role-input"
                      type="text"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-700 mb-1">
                      Assign Table
                    </span>
                    <CustomSelectPopover
                      id="guest-table-select"
                      ariaLabel="Assign Table"
                      variant="light"
                      className="w-full"
                      value={newTableNumber === null ? 'unassigned' : String(newTableNumber)}
                      onChange={(val) =>
                        setNewTableNumber(val === 'unassigned' ? null : Number(val))
                      }
                      options={[
                        { value: 'unassigned', label: 'Unassigned' },
                        ...tables.map((t) => ({
                          value: String(t.tableNumber),
                          label: `Table 0${t.tableNumber} (${t.zone})`,
                        })),
                      ]}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 px-4 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Add Guest to Roster
                </button>
              </form>

              {/* Dietary Distribution Breakdown */}
              <div className="p-4 border border-slate-200 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold text-slate-900">
                  Culinary & Allergen Seat Breakdown
                </h4>
                <div className="space-y-1.5 text-xs text-slate-600">
                  {Object.entries(seatingMetrics.dietaryCounts).map(([diet, count]) => (
                    <div key={diet} className="flex items-center justify-between">
                      <span>{diet}</span>
                      <span className="font-mono tabular-nums font-medium text-slate-900">
                        {count} seats
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Guest Table Assignment Grid */}
            <div className="lg:col-span-8 space-y-4">
              {feedbackMsg && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                    feedbackMsg.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {feedbackMsg.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <Check className="w-4 h-4 shrink-0" />
                    )}
                    <span>{feedbackMsg.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeedbackMsg(null)}
                    className="text-xs underline ml-4 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['All', 'Confirmed', 'Pending', 'Declined'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterRsvp(st)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        filterRsvp === st
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  aria-label="Search guests by name or dietary profile"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search guest, role, or dietary..."
                  className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md w-60"
                />
              </div>

              {/* Guest Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-3">Guest Party</th>
                      <th className="py-2.5 px-3 text-right">Party Size</th>
                      <th className="py-2.5 px-3">Dietary</th>
                      <th className="py-2.5 px-3">RSVP Status</th>
                      <th className="py-2.5 px-3">3D Table Seat</th>
                      <th className="py-2.5 px-3 text-right">Share Seating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredGuests.map((guest) => {
                      const partySize = 1 + Math.max(0, guest.plusOnes);
                      return (
                        <tr key={guest.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{guest.fullName}</div>
                            <div className="text-slate-500">
                              {guest.role} · {guest.email}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                            {partySize} {partySize === 1 ? 'seat' : 'seats'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{guest.dietary}</td>
                          <td className="py-2.5 px-3">
                            <CustomSelectPopover
                              ariaLabel={`RSVP status for ${guest.fullName}`}
                              variant="light"
                              value={guest.rsvpStatus}
                              onChange={(val) =>
                                onUpdateRsvpStatus(
                                  guest.id,
                                  val as GuestRecord['rsvpStatus']
                                )
                              }
                              options={[
                                { value: 'Confirmed', label: 'Confirmed' },
                                { value: 'Pending', label: 'Pending' },
                                { value: 'Declined', label: 'Declined' },
                              ]}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <CustomSelectPopover
                              ariaLabel={`Table assignment for ${guest.fullName}`}
                              variant="light"
                              disabled={guest.rsvpStatus === 'Declined'}
                              value={guest.tableNumber === null ? 'unassigned' : String(guest.tableNumber)}
                              onChange={(val) => handleSeatChange(guest.id, val)}
                              options={[
                                { value: 'unassigned', label: 'Unassigned' },
                                ...tables.map((t) => {
                                  const occ =
                                    seatingMetrics.tableOccupancy[t.tableNumber]?.occupied || 0;
                                  return {
                                    value: String(t.tableNumber),
                                    label: `Table 0${t.tableNumber} (${occ}/${t.capacity})`,
                                  };
                                }),
                              ]}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              data-testid={`share-guest-qr-btn-${guest.id}`}
                              onClick={() => {
                                setSelectedQrGuestId(guest.id);
                                setActiveModalTab('share-qr');
                                setMobileScanSimulated(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-semibold cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>QR Pass</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SHARE SEATING — UNIQUE GUEST QR CODE & MOBILE ZONE MAP */}
        {activeModalTab === 'share-qr' && activeQrPass && (
          <div
            className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[78vh] overflow-y-auto"
            data-testid="share-seating-panel"
          >
            {/* Left 6 Columns: Guest Selector & Unique Scannable QR Code Card */}
            <div className="lg:col-span-6 space-y-5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Select Guest to Generate Unique Seating QR
                  </span>
                  <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {guests.length} Guest Passes Ready
                  </span>
                </div>

                <CustomSelectPopover
                  ariaLabel="Select Guest for QR Seating Pass"
                  variant="light"
                  className="w-full"
                  value={activeQrPass.guestId}
                  onChange={(val) => {
                    setSelectedQrGuestId(val);
                    setMobileScanSimulated(false);
                  }}
                  options={guests.map((g) => ({
                    value: g.id,
                    label: g.fullName,
                    badge:
                      g.tableNumber !== null ? `Table 0${g.tableNumber}` : 'Unassigned',
                    sublabel: `${g.role} · ${1 + Math.max(0, g.plusOnes)} seat(s) · ${g.dietary}`,
                  }))}
                />

                {/* Quick horizontal guest pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {guests.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      data-testid={`select-qr-guest-${g.id}`}
                      onClick={() => {
                        setSelectedQrGuestId(g.id);
                        setMobileScanSimulated(true);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        g.id === activeQrPass.guestId
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {g.fullName.split(' ')[0]} ({g.tableNumber ? `T0${g.tableNumber}` : 'Wait'})
                    </button>
                  ))}
                </div>
              </div>

              {/* Unique Scannable QR Pass Card */}
              <div
                data-testid="guest-qr-card"
                data-verification-code={activeQrPass.verificationCode}
                className="p-5 bg-white border-2 border-slate-900 rounded-2xl shadow-lg space-y-4"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-widest text-indigo-600 font-semibold">
                      Aura Digital Seating Pass
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                      {activeQrPass.guestName}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {activeQrPass.role} · {activeQrPass.partySize}{' '}
                      {activeQrPass.partySize === 1 ? 'Seat' : 'Seats'} · {activeQrPass.dietary}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <div className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 text-xs font-bold">
                      {activeQrPass.assignedTableNumber
                        ? `TABLE 0${activeQrPass.assignedTableNumber}`
                        : 'UNASSIGNED'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {activeQrPass.assignedZone}
                    </div>
                  </div>
                </div>

                {/* Scannable 21x21 Deterministic SVG QR Code */}
                <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="p-3 bg-white rounded-xl border-2 border-slate-900 shadow-sm shrink-0">
                    <svg
                      data-testid="guest-qr-svg"
                      viewBox="0 0 23 23"
                      className="w-36 h-36"
                      role="img"
                      aria-label={`Unique seating QR code for ${activeQrPass.guestName}`}
                    >
                      <rect width="23" height="23" fill="#FFFFFF" />
                      {activeQrPass.qrMatrix.map((row, rIdx) =>
                        row.map((cell, cIdx) =>
                          cell ? (
                            <rect
                              key={`${rIdx}-${cIdx}`}
                              x={cIdx + 1}
                              y={rIdx + 1}
                              width={1}
                              height={1}
                              fill="#0F172A"
                            />
                          ) : null
                        )
                      )}
                    </svg>
                  </div>

                  <div className="space-y-2.5 text-xs flex-1">
                    <div>
                      <div className="text-slate-500 font-medium">Pass Verification ID</div>
                      <div
                        data-testid="qr-verification-code"
                        className="font-mono font-bold text-slate-900 text-sm"
                      >
                        {activeQrPass.verificationCode}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-medium">Mobile Scan Destination</div>
                      <div className="font-mono text-[11px] text-slate-600 break-all bg-white px-2 py-1 rounded border border-slate-200 mt-0.5">
                        {activeQrPass.shareUrl}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        data-testid="copy-guest-qr-link-btn"
                        onClick={handleCopyShareUrl}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>
                          {copiedGuestId === activeQrPass.guestId
                            ? 'Copied Mobile Link!'
                            : 'Copy Share Link'}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid="simulate-mobile-scan-btn"
                        onClick={() => setMobileScanSimulated(true)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Simulate Mobile QR Scan</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 6 Columns: Mobile Device Scanned View (Assigned Table + Interactive Venue Zone Map) */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div
                data-testid="mobile-seating-zone-map"
                data-scanned-guest={activeQrPass.guestName}
                data-scanned-table={activeQrPass.assignedTableNumber ?? 'unassigned'}
                data-scanned-zone={activeQrPass.assignedZone}
                className={`w-full max-w-[390px] rounded-[28px] border-4 ${
                  mobileScanSimulated ? 'border-emerald-500' : 'border-slate-900'
                } bg-[#0B0F19] text-slate-100 shadow-2xl overflow-hidden transition-colors`}
              >
                {/* Mobile Top Status Bar */}
                <div className="px-5 py-3 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>MOBILE GUEST SCAN VIEW</span>
                  </span>
                  <span className="text-slate-400">{activeQrPass.verificationCode}</span>
                </div>

                {/* Mobile Pass Content */}
                <div className="p-5 space-y-4">
                  {/* Guest & Assigned Table Callout Banner */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] text-amber-400 font-mono uppercase">
                        Welcome Guest Party
                      </div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {activeQrPass.guestName}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {activeQrPass.partySize} Seat(s) · {activeQrPass.dietary} Menu
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        data-testid="mobile-assigned-table-badge"
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-mono font-bold text-xs"
                      >
                        {activeQrPass.assignedTableNumber
                          ? `TABLE 0${activeQrPass.assignedTableNumber}`
                          : 'HOST DESK'}
                      </div>
                      <div
                        data-testid="mobile-assigned-zone-badge"
                        className="text-[11px] font-mono text-emerald-300 mt-1"
                      >
                        {activeQrPass.assignedZone}
                      </div>
                    </div>
                  </div>

                  {/* Interactive 2D Mobile Venue Zone & Table Locator Map */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Live Mobile Venue Zone Map</span>
                      </span>
                      <span className="text-[11px] font-mono text-amber-300">
                        {activeQrPass.assignedZone}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-[#0F172A] border border-slate-800 p-2 overflow-hidden">
                      <svg
                        data-testid="mobile-zone-map-svg"
                        viewBox="0 0 320 220"
                        className="w-full h-auto"
                        role="img"
                        aria-label={`Mobile zone map showing ${activeQrPass.assignedTableLabel} in ${activeQrPass.assignedZone}`}
                      >
                        {/* 4 Architectural Venue Zones */}
                        {/* West Pavilion */}
                        <rect
                          x="10"
                          y="42"
                          width="92"
                          height="155"
                          rx="8"
                          fill={
                            activeQrPass.assignedZone === 'West Pavilion'
                              ? 'rgba(16, 185, 129, 0.16)'
                              : 'rgba(30, 41, 59, 0.55)'
                          }
                          stroke={
                            activeQrPass.assignedZone === 'West Pavilion'
                              ? '#10B981'
                              : '#334155'
                          }
                          strokeWidth="1.2"
                        />
                        <text x="18" y="56" fill="#94A3B8" fontSize="8" fontFamily="monospace">
                          WEST PAVILION
                        </text>

                        {/* Head Table & VIP Garden Center Zone */}
                        <rect
                          x="108"
                          y="42"
                          width="104"
                          height="68"
                          rx="8"
                          fill={
                            activeQrPass.assignedZone === 'Head Table'
                              ? 'rgba(245, 158, 11, 0.18)'
                              : 'rgba(30, 41, 59, 0.55)'
                          }
                          stroke={
                            activeQrPass.assignedZone === 'Head Table'
                              ? '#F59E0B'
                              : '#334155'
                          }
                          strokeWidth="1.2"
                        />
                        <text x="132" y="55" fill="#FCD34D" fontSize="8" fontFamily="monospace">
                          HEAD TABLE ZONE
                        </text>

                        <rect
                          x="108"
                          y="116"
                          width="104"
                          height="81"
                          rx="8"
                          fill={
                            activeQrPass.assignedZone === 'VIP Garden'
                              ? 'rgba(16, 185, 129, 0.16)'
                              : 'rgba(30, 41, 59, 0.55)'
                          }
                          stroke={
                            activeQrPass.assignedZone === 'VIP Garden'
                              ? '#10B981'
                              : '#334155'
                          }
                          strokeWidth="1.2"
                        />
                        <text x="136" y="129" fill="#94A3B8" fontSize="8" fontFamily="monospace">
                          VIP GARDEN
                        </text>

                        {/* East Terrace */}
                        <rect
                          x="218"
                          y="42"
                          width="92"
                          height="155"
                          rx="8"
                          fill={
                            activeQrPass.assignedZone === 'East Terrace'
                              ? 'rgba(16, 185, 129, 0.16)'
                              : 'rgba(30, 41, 59, 0.55)'
                          }
                          stroke={
                            activeQrPass.assignedZone === 'East Terrace'
                              ? '#10B981'
                              : '#334155'
                          }
                          strokeWidth="1.2"
                        />
                        <text x="232" y="56" fill="#94A3B8" fontSize="8" fontFamily="monospace">
                          EAST TERRACE
                        </text>

                        {/* Ceremonial Mandap Stage at Top */}
                        <rect
                          x="114"
                          y="10"
                          width="92"
                          height="24"
                          rx="6"
                          fill="#1E293B"
                          stroke="#C89D54"
                          strokeWidth="1.5"
                        />
                        <text
                          x="160"
                          y="25"
                          textAnchor="middle"
                          fill="#FDE68A"
                          fontSize="8.5"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          CEREMONIAL STAGE
                        </text>

                        {/* Walking Path from Entrance to Assigned Table */}
                        {assignedPin && (
                          <path
                            d={`M 160 212 Q 160 ${(212 + assignedPin.svgY) / 2} ${assignedPin.svgX} ${assignedPin.svgY}`}
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2"
                            strokeDasharray="4 3"
                          />
                        )}

                        {/* All Banquet Table Pins */}
                        {activeQrPass.mapPins.map((pin) => (
                          <g key={pin.tableNumber}>
                            {pin.isAssignedTable && (
                              <circle
                                cx={pin.svgX}
                                cy={pin.svgY}
                                r={18}
                                fill="rgba(16, 185, 129, 0.25)"
                                stroke="#10B981"
                                strokeWidth="1.5"
                              />
                            )}
                            <circle
                              cx={pin.svgX}
                              cy={pin.svgY}
                              r={pin.isAssignedTable ? 12 : 9}
                              fill={pin.isAssignedTable ? '#10B981' : '#1E293B'}
                              stroke={pin.isAssignedTable ? '#FFFFFF' : '#64748B'}
                              strokeWidth={pin.isAssignedTable ? '2' : '1.2'}
                            />
                            <text
                              x={pin.svgX}
                              y={pin.svgY + 3}
                              textAnchor="middle"
                              fill={pin.isAssignedTable ? '#022C22' : '#E2E8F0'}
                              fontSize={pin.isAssignedTable ? '8.5' : '7.5'}
                              fontWeight="bold"
                              fontFamily="monospace"
                            >
                              T{pin.tableNumber}
                            </text>
                          </g>
                        ))}

                        {/* Main Entrance Indicator at Bottom */}
                        <rect
                          x="122"
                          y="202"
                          width="76"
                          height="14"
                          rx="4"
                          fill="#0F172A"
                          stroke="#475569"
                        />
                        <text
                          x="160"
                          y="212"
                          textAnchor="middle"
                          fill="#94A3B8"
                          fontSize="7.5"
                          fontFamily="monospace"
                        >
                          ▲ MAIN ENTRANCE
                        </text>
                      </svg>
                    </div>
                  </div>

                  {/* Wayfinding Directions Footer */}
                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-200">
                    <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {activeQrPass.assignedTableNumber
                        ? `Enter via North Courtyard Gate → Follow emerald path to ${activeQrPass.assignedZone} (${activeQrPass.assignedTableLabel}).`
                        : 'Please check in at the Welcome Concierge Desk for immediate table assignment.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

