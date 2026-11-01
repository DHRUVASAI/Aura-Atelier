import React, { useEffect, useState } from 'react';
import {
  BudgetLineItem,
  CollaboratorActivity,
  EventPreset,
  PaymentTransaction,
  TimelineMilestone,
  VendorRecord,
} from '../types/planning';
import { BudgetSummaryMetrics, formatINR } from '../utils/planningLogic';
import {
  IndianRupee,
  ShieldCheck,
  Sparkles,
  Plus,
  Clock,
  Users,
  Trash2,
  Calendar,
  FileText,
  CheckSquare,
  AlertTriangle,
} from 'lucide-react';
import { CustomSelectPopover } from './CustomSelectPopover';
import {
  createCalendarMilestone,
  createGoogleTask,
  createRunOfShowGoogleDoc,
  googleSignIn,
  subscribeWorkspaceAuth,
} from '../services/firebaseAuth';

interface BudgetAndPaymentsViewProps {
  preset?: EventPreset;
  budgetItems: BudgetLineItem[];
  budgetMetrics: BudgetSummaryMetrics;
  vendors: VendorRecord[];
  transactions: PaymentTransaction[];
  timeline: TimelineMilestone[];
  collaboratorFeed: CollaboratorActivity[];
  onOptimizeBudget: () => string[];
  onAddBudgetItem: (item: Omit<BudgetLineItem, 'id'>) => void;
  onUpdateBudgetItem: (id: string, allocated: number, spent: number) => void;
  onDeleteBudgetItem: (id: string) => void;
  onUpdateBudgetCap: (newCap: number) => void;
  onProcessPayment: (
    vendorId: string,
    amount: number,
    method: PaymentTransaction['method']
  ) => { ok: boolean; error?: string };
  onAddMilestone: (milestone: Omit<TimelineMilestone, 'id'>) => void;
}

export const BudgetAndPaymentsView: React.FC<BudgetAndPaymentsViewProps> = ({
  preset,
  budgetItems,
  budgetMetrics,
  vendors,
  transactions,
  timeline,
  collaboratorFeed,
  onOptimizeBudget,
  onAddBudgetItem,
  onUpdateBudgetItem,
  onDeleteBudgetItem,
  onUpdateBudgetCap,
  onProcessPayment,
  onAddMilestone,
}) => {
  const [optimizationNotes, setOptimizationNotes] = useState<string[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] =
    useState<BudgetLineItem['category']>('Culinary & Beverage');
  const [newAllocated, setNewAllocated] = useState(150000);
  const [newSpent, setNewSpent] = useState(0);
  const [newPriority] = useState<BudgetLineItem['priority']>('elevated');

  // Payment Gateway Form State
  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    vendors.find((v) => v.negotiatedTarget > v.paidAmount)?.id || vendors[0]?.id || ''
  );
  const [paymentAmount, setPaymentAmount] = useState<number>(100000);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentTransaction['method']>('Escrow Wire');
  const [paymentFeedback, setPaymentFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Timeline Form State
  const [msTime, setMsTime] = useState('20:30');
  const [msTitle, setMsTitle] = useState('');
  const [msOwner] = useState('Lead Producer');
  const [msLocation, setMsLocation] = useState('Main Courtyard');

  // Contextual Google Workspace State (Calendar, Docs, Tasks)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [workspaceBanner, setWorkspaceBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [createdDocInfo, setCreatedDocInfo] = useState<{
    documentId: string;
    title: string;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [isExecutingWorkspace, setIsExecutingWorkspace] = useState(false);

  useEffect(() => {
    const unsub = subscribeWorkspaceAuth((state) => {
      setIsAuthenticated(state.isAuthenticated);
    });
    return () => unsub();
  }, []);

  const eventTitle = preset?.name || 'Active Event';
  const eventDate = preset?.date || '2026-11-24';
  const eventVenue = preset?.venueName || 'Main Venue';

  const handleRunOptimization = () => {
    const notes = onOptimizeBudget();
    setOptimizationNotes(notes);
  };

  const handleCreateBudgetLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddBudgetItem({
      category: newCategory,
      title: newTitle.trim(),
      allocated: Math.max(0, Number(newAllocated) || 0),
      spent: Math.max(0, Number(newSpent) || 0),
      notes: 'User-defined budget line',
      priority: newPriority,
    });
    setNewTitle('');
    setNewAllocated(150000);
    setNewSpent(0);
  };

  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) return;
    const res = onProcessPayment(selectedVendorId, Number(paymentAmount), paymentMethod);
    if (!res.ok) {
      setPaymentFeedback({
        type: 'error',
        text: res.error || 'Unable to process vendor payment.',
      });
    } else {
      const targetVendor = vendors.find((v) => v.id === selectedVendorId);
      setPaymentFeedback({
        type: 'success',
        text: `Settled ${formatINR(Number(paymentAmount))} to ${
          targetVendor?.name || 'Vendor'
        } via ${paymentMethod}. Ledger & budget synchronized.`,
      });
    }
  };

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;
    onAddMilestone({
      time: msTime,
      title: msTitle.trim(),
      owner: msOwner.trim() || 'Lead Planner',
      locationZone: msLocation.trim() || 'Main Hall',
      status: 'On Track',
    });
    setMsTitle('');
  };

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);
  const selectedVendorBalance = selectedVendor
    ? Math.max(0, selectedVendor.negotiatedTarget - selectedVendor.paidAmount)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
      {/* Section Header + Resource Allocation + Contextual Google Docs Export */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs text-slate-500">
            01. Real-Time ₹ INR Financial Ledger · Collaborative Planning · Escrow Gateway
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display mt-1">
            Smart Rupee (₹) Budget Tracking & Vendor Payment Gateway
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={async () => {
              if (!isAuthenticated) {
                await googleSignIn();
              }
              setPendingConfirm({
                title: 'Export Financial & Run-of-Show Brief to Google Docs?',
                description: `Create a formatted Google Doc titled "${eventTitle} — Financial & Run-of-Show Brief" with your ${formatINR(budgetMetrics.totalCap)} ledger and ${timeline.length} timeline cues?`,
                actionLabel: 'Create Google Doc',
                onConfirm: async () => {
                  const docText = `${eventTitle}\nVenue: ${eventVenue}\nDate: ${eventDate}\nMaster Cap: ${formatINR(budgetMetrics.totalCap)}\nAllocated: ${formatINR(budgetMetrics.totalAllocated)}\nSettled: ${formatINR(budgetMetrics.totalSpent)}\n\nTIMELINE CUES:\n${timeline
                    .map((t) => `- ${t.time}: ${t.title} (${t.locationZone})`)
                    .join('\n')}\n\nVENDORS:\n${vendors
                    .map((v) => `- ${v.name}: Target ${formatINR(v.negotiatedTarget)} (Paid: ${formatINR(v.paidAmount)})`)
                    .join('\n')}\n`;
                  const doc = await createRunOfShowGoogleDoc(
                    `${eventTitle} — Financial & Run-of-Show Brief`,
                    docText
                  );
                  setCreatedDocInfo(doc);
                  setWorkspaceBanner({
                    type: 'success',
                    text: `Exported "${doc.title}" to Google Docs.`,
                  });
                },
              });
            }}
            className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export Brief to Google Docs</span>
          </button>

          <button
            type="button"
            onClick={handleRunOptimization}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Auto-Balance ₹ Budget Allocation</span>
          </button>
        </div>
      </div>

      {workspaceBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
            workspaceBanner.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{workspaceBanner.text}</span>
          {createdDocInfo && !createdDocInfo.documentId.startsWith('doc-') && (
            <a
              href={`https://docs.google.com/document/d/${createdDocInfo.documentId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              Open in Google Docs →
            </a>
          )}
        </div>
      )}

      {/* KPI Strip in Indian Rupees (₹) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl">
          <label htmlFor="master-cap-input" className="block text-xs text-slate-500">
            Master Event Cap (₹ — Editable)
          </label>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xl font-bold text-slate-900 font-mono">₹</span>
            <input
              id="master-cap-input"
              type="number"
              min={10000}
              step={25000}
              value={budgetMetrics.totalCap}
              onChange={(e) => onUpdateBudgetCap(Number(e.target.value))}
              className="w-full text-xl font-bold text-slate-900 font-mono tabular-nums bg-slate-50 border border-slate-300 rounded px-2 py-0.5"
            />
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Status: <span className="font-semibold text-slate-800">{budgetMetrics.healthStatus}</span>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl">
          <div className="text-xs text-slate-500">Total Allocated Scope</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {formatINR(budgetMetrics.totalAllocated)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            Unallocated Reserve: {formatINR(budgetMetrics.remainingToAllocate)}
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl">
          <div className="text-xs text-slate-500">Settled & Disbursed</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {formatINR(budgetMetrics.totalSpent)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            {budgetMetrics.utilizationPercent}% of master cap utilized
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl">
          <div className="text-xs text-slate-500">Remaining Cash Buffer</div>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {formatINR(budgetMetrics.remainingCashBuffer)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {budgetMetrics.overBudgetCategories.length === 0
              ? 'Zero categories over allocation'
              : `${budgetMetrics.overBudgetCategories.length} department watch item(s)`}
          </div>
        </div>
      </div>

      {/* Optimization Output Banner */}
      {optimizationNotes.length > 0 && (
        <div className="p-5 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-amber-400">
            Resource Allocation Recommendations Applied
          </div>
          <ul className="space-y-1 text-xs text-slate-200 list-disc pl-4">
            {optimizationNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main 12-Col Grid: Budget Ledger (Left 8) + Secure Payment Gateway (Right 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Department Resource Ledger (₹ INR)
              </h2>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {budgetItems.length} Line Items
              </span>
            </div>

            {budgetItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Your budget ledger is empty. Use the form below to add your own custom budget items in Rupees (₹).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Department & Line Item</th>
                      <th className="py-3 px-4">Tier</th>
                      <th className="py-3 px-4 text-right">Allocated (₹)</th>
                      <th className="py-3 px-4 text-right">Actual Spent (₹)</th>
                      <th className="py-3 px-4 text-right">Variance</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {budgetItems.map((item) => {
                      const variance = item.allocated - item.spent;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{item.title}</div>
                            <div className="text-slate-500">
                              {item.category} · {item.notes}
                            </div>
                          </td>
                          <td className="py-3 px-4 capitalize text-slate-600">{item.priority}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <input
                              type="number"
                              aria-label={`Allocated amount for ${item.title}`}
                              value={item.allocated}
                              onChange={(e) =>
                                onUpdateBudgetItem(item.id, Number(e.target.value), item.spent)
                              }
                              className="w-28 text-right px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono tabular-nums text-slate-900"
                            />
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <input
                              type="number"
                              aria-label={`Spent amount for ${item.title}`}
                              value={item.spent}
                              onChange={(e) =>
                                onUpdateBudgetItem(item.id, item.allocated, Number(e.target.value))
                              }
                              className="w-28 text-right px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono tabular-nums text-slate-900"
                            />
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                              variance < 0 ? 'text-red-600' : 'text-emerald-700'
                            }`}
                          >
                            {variance >= 0
                              ? `+${formatINR(variance)}`
                              : `-${formatINR(Math.abs(variance))}`}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => onDeleteBudgetItem(item.id)}
                              aria-label={`Delete ${item.title}`}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add Line Item Form */}
            <form
              onSubmit={handleCreateBudgetLine}
              className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-4">
                <label htmlFor="budget-line-title" className="block text-xs font-medium text-slate-700 mb-1">
                  New Budget Item
                </label>
                <input
                  id="budget-line-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Sangeet Dhol & Folk Artists"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                />
              </div>
              <div className="sm:col-span-3">
                <span className="block text-xs font-medium text-slate-700 mb-1">
                  Department
                </span>
                <CustomSelectPopover
                  id="budget-line-cat"
                  ariaLabel="Department"
                  variant="light"
                  className="w-full"
                  value={newCategory}
                  onChange={(val) => setNewCategory(val as BudgetLineItem['category'])}
                  options={[
                    { value: 'Venue & Architecture', label: 'Venue & Architecture' },
                    { value: 'Culinary & Beverage', label: 'Culinary & Beverage' },
                    { value: 'Floral & Botanicals', label: 'Floral & Botanicals' },
                    { value: 'Production & Audio', label: 'Production & Audio' },
                    { value: 'Photography & Cinema', label: 'Photography & Cinema' },
                    { value: 'Attire & Styling', label: 'Attire & Styling' },
                  ]}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="budget-line-alloc" className="block text-xs font-medium text-slate-700 mb-1">
                  Allocated (₹)
                </label>
                <input
                  id="budget-line-alloc"
                  type="number"
                  value={newAllocated}
                  onChange={(e) => setNewAllocated(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono tabular-nums"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add ₹ Line Item</span>
                </button>
              </div>
            </form>
          </div>

          {/* Collaborative Milestone Timeline + Contextual Google Calendar Sync */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <span>Event Run-of-Show & Milestone Schedule</span>
              </h2>
              <button
                type="button"
                onClick={async () => {
                  if (!isAuthenticated) {
                    await googleSignIn();
                  }
                  setPendingConfirm({
                    title: 'Sync Milestones to Google Calendar?',
                    description: `Publish ${timeline.length} run-of-show milestones for "${eventTitle}" on ${eventDate} to your primary Google Calendar?`,
                    actionLabel: 'Confirm & Sync Calendar',
                    onConfirm: async () => {
                      for (const ms of timeline.slice(0, 4)) {
                        await createCalendarMilestone(
                          `${eventTitle}: ${ms.title}`,
                          eventDate,
                          ms.time,
                          eventVenue,
                          `Owner: ${ms.owner} · Zone: ${ms.locationZone}`
                        );
                      }
                      setWorkspaceBanner({
                        type: 'success',
                        text: `Synced ${timeline.length} run-of-show milestones for ${eventDate} to Google Calendar.`,
                      });
                    },
                  });
                }}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Sync Schedule to Google Calendar</span>
              </button>
            </div>

            <div className="divide-y divide-slate-200 text-xs">
              {timeline.map((ms) => (
                <div key={ms.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                      {ms.time}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-900">{ms.title}</div>
                      <div className="text-slate-500">
                        Owner: {ms.owner} · Zone: {ms.locationZone}
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-700 font-medium">
                    Status: {ms.status}
                    {ms.syncedToCalendar ? ' · Synced to Calendar' : ''}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleCreateMilestone}
              className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
            >
              <div className="sm:col-span-2">
                <label htmlFor="ms-time" className="block text-xs text-slate-600 mb-1">
                  Cue Time
                </label>
                <input
                  id="ms-time"
                  type="text"
                  value={msTime}
                  onChange={(e) => setMsTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono tabular-nums"
                />
              </div>
              <div className="sm:col-span-5">
                <label htmlFor="ms-title" className="block text-xs text-slate-600 mb-1">
                  Milestone Cue
                </label>
                <input
                  id="ms-title"
                  type="text"
                  value={msTitle}
                  onChange={(e) => setMsTitle(e.target.value)}
                  placeholder="e.g., Baraat Welcome & Sangeet Opening"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="ms-zone" className="block text-xs text-slate-600 mb-1">
                  Venue Zone
                </label>
                <input
                  id="ms-zone"
                  type="text"
                  value={msLocation}
                  onChange={(e) => setMsLocation(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 cursor-pointer"
                >
                  Add Cue
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right 4 Columns: Secure Vendor Payment Gateway & Live Collaborator Feed */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Vendor Escrow & Payment Gateway (₹)</span>
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Authorize milestone deposits and venue buyouts in Indian Rupees (₹) with automated ledger reconciliation.
            </p>

            {paymentFeedback && (
              <div
                className={`p-3 rounded-lg border text-xs ${
                  paymentFeedback.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {paymentFeedback.text}
              </div>
            )}

            <form onSubmit={handleExecutePayment} className="space-y-3">
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1">
                  Select Contracted Vendor
                </span>
                <CustomSelectPopover
                  id="pay-vendor-select"
                  ariaLabel="Select Contracted Vendor"
                  variant="light"
                  className="w-full"
                  value={selectedVendorId}
                  onChange={(nextId) => {
                    setSelectedVendorId(nextId);
                    const v = vendors.find((item) => item.id === nextId);
                    if (v) {
                      const rem = Math.max(0, v.negotiatedTarget - v.paidAmount);
                      setPaymentAmount(rem > 0 ? Math.min(100000, rem) : 25000);
                    }
                  }}
                  options={vendors.map((v) => {
                    const rem = Math.max(0, v.negotiatedTarget - v.paidAmount);
                    return {
                      value: v.id,
                      label: `${v.name} (Balance: ${formatINR(rem)})`,
                    };
                  })}
                />
              </div>

              {selectedVendor && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Agreed Contract Target:</span>
                    <span className="font-mono tabular-nums font-semibold">
                      {formatINR(selectedVendor.negotiatedTarget)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paid to Date:</span>
                    <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                      {formatINR(selectedVendor.paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Remaining Balance Due:</span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      {formatINR(selectedVendorBalance)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pay-amount-input" className="block text-xs font-medium text-slate-700 mb-1">
                    Disbursement (₹)
                  </label>
                  <input
                    id="pay-amount-input"
                    type="number"
                    min={1}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono tabular-nums"
                  />
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-700 mb-1">
                    Settlement Rail
                  </span>
                  <CustomSelectPopover
                    id="pay-method-select"
                    ariaLabel="Settlement Rail"
                    variant="light"
                    className="w-full"
                    value={paymentMethod}
                    onChange={(val) =>
                      setPaymentMethod(val as PaymentTransaction['method'])
                    }
                    options={[
                      { value: 'Escrow Wire', label: 'Escrow Wire (1.5% fee)' },
                      { value: 'ACH Direct', label: 'Direct Bank Transfer (₹0 fee)' },
                      { value: 'Corporate Card', label: 'Corporate Card' },
                    ]}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <IndianRupee className="w-4 h-4" />
                <span>Authorize ₹ Disbursement</span>
              </button>
            </form>

            {/* Recent Settlement Receipts */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                Recent Transaction Receipts
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span className="truncate max-w-[180px]">{tx.vendorName}</span>
                      <span className="font-mono tabular-nums">
                        {formatINR(tx.amount)}
                      </span>
                    </div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      {tx.referenceCode} · {tx.method} · {tx.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Collaborative Activity Log + Contextual Google Tasks Action Push */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                <span>Collaborative Planning Activity</span>
              </h3>
              <button
                type="button"
                onClick={async () => {
                  if (!isAuthenticated) {
                    await googleSignIn();
                  }
                  setPendingConfirm({
                    title: 'Push Action Items to Google Tasks?',
                    description: `Export open vendor production checklists and payment follow-ups for "${eventTitle}" to your primary Google Tasks list?`,
                    actionLabel: 'Export to Google Tasks',
                    onConfirm: async () => {
                      const openTasks = vendors.flatMap((v) =>
                        v.checklist
                          .filter((c) => !c.completed)
                          .map((c) => ({ vendor: v.name, ...c }))
                      );
                      for (const t of openTasks.slice(0, 3)) {
                        await createGoogleTask(
                          `[${t.vendor}] ${t.task}`,
                          `Event: ${eventTitle}`,
                          t.dueDate
                        );
                      }
                      setWorkspaceBanner({
                        type: 'success',
                        text: 'Pushed open vendor checklist items to Google Tasks.',
                      });
                    },
                  });
                }}
                className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sync Tasks</span>
              </button>
            </div>
            <div className="divide-y divide-slate-200 text-xs">
              {collaboratorFeed.map((item) => (
                <div key={item.id} className="py-2.5 space-y-0.5">
                  <div className="font-semibold text-slate-900">{item.actor}</div>
                  <div className="text-slate-600">{item.action}</div>
                  <div className="text-slate-400 text-[11px]">
                    {item.role} · {item.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Confirmation Dialog for Calendar, Docs & Tasks Mutations */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-workspace-confirm-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 id="budget-workspace-confirm-title" className="text-base font-bold text-slate-900">
                  {pendingConfirm.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {pendingConfirm.description}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                disabled={isExecutingWorkspace}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecutingWorkspace}
                onClick={async () => {
                  setIsExecutingWorkspace(true);
                  try {
                    await pendingConfirm.onConfirm();
                  } catch (err: any) {
                    setWorkspaceBanner({
                      type: 'error',
                      text: err?.message || 'Workspace operation failed.',
                    });
                  } finally {
                    setIsExecutingWorkspace(false);
                    setPendingConfirm(null);
                  }
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 cursor-pointer"
              >
                {isExecutingWorkspace ? 'Syncing...' : pendingConfirm.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
