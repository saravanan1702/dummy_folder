"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import clsx from "clsx";
import { ArrowLeft, Check, CircleAlert, CloudOff, Copy, Play, Plus, RotateCw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import useSWR from "swr";
import { Badge, Button, IconButton, Spinner, useToast } from "@/components/ui";
import { RequestError, api, errorMessage } from "@/lib/client";
import {
  HANDLE_NEXT,
  defaultNodeData,
  newId,
  sourceHandles,
  type FlowEdge,
  type FlowGraph,
  type FlowIssue,
  type FlowNode,
  type NodeKind,
} from "@/lib/flow/types";
import { BuilderContext, type BuilderData, type TriggerSummary } from "./context";
import { NodeEditor } from "./editor";
import { ADDABLE, NODE_META } from "./meta";
import { nodeTypes, type RFNode } from "./nodes";

interface FlowPayload {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED";
  draft: FlowGraph;
  hasUnpublishedChanges: boolean;
  triggers: TriggerSummary[];
}

type SaveState = "saved" | "saving" | "dirty" | "error";

const EDGE_STYLE = { strokeWidth: 2 };
const EDGE_MARKER = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#a5a1c2" };

function toRF(graph: FlowGraph): { nodes: RFNode[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data as Record<string, unknown>,
      deletable: n.type !== "trigger",
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle ?? HANDLE_NEXT,
      target: e.target,
      markerEnd: EDGE_MARKER,
      style: EDGE_STYLE,
    })),
  };
}

function toGraph(nodes: RFNode[], edges: Edge[]): FlowGraph {
  const graphNodes = nodes.map(
    (n) =>
      ({
        id: n.id,
        type: n.type,
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        data: n.data,
      }) as FlowNode,
  );
  const handlesById = new Map(graphNodes.map((n) => [n.id, new Set(sourceHandles(n))]));
  const graphEdges: FlowEdge[] = edges
    // Drop connections whose button / branch no longer exists.
    .filter((e) => handlesById.get(e.source)?.has(e.sourceHandle ?? HANDLE_NEXT) && handlesById.has(e.target))
    .map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? HANDLE_NEXT, target: e.target }));
  return { nodes: graphNodes, edges: graphEdges };
}

export function FlowBuilder({ flowId }: { flowId: string }) {
  const { data, error } = useSWR<{ flow: FlowPayload }>(`/api/flows/${flowId}`, { revalidateOnFocus: false });
  if (error) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-canvas">
        <p className="text-sm text-slate-600">{errorMessage(error)}</p>
        <Link href="/app/automation" className="text-sm font-semibold text-brand-700 hover:underline">
          Back to Automation
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-canvas">
        <Spinner className="size-7" />
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <Canvas flow={data.flow} />
    </ReactFlowProvider>
  );
}

function Canvas({ flow }: { flow: FlowPayload }) {
  const toast = useToast();
  const initial = useMemo(() => toRF(flow.draft), [flow.draft]);
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const { screenToFlowPosition, setCenter, getNode, fitView } = useReactFlow();

  // Frame the whole flow once, after every step has been measured.
  const measured = useNodesInitialized();
  const framed = useRef(false);
  useEffect(() => {
    if (!measured || framed.current) return;
    framed.current = true;
    void fitView({ padding: 0.2, maxZoom: 1 });
  }, [measured, fitView]);
  const wrapper = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(flow.name);
  const [status, setStatus] = useState(flow.status);
  const [unpublished, setUnpublished] = useState(flow.hasUnpublishedChanges);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [issues, setIssues] = useState<FlowIssue[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [picker, setPicker] = useState<{ x: number; y: number; source: string; handle: string } | null>(null);

  // Reference data for the editors and node summaries.
  const tagsQuery = useSWR<{ tags: { id: string; name: string }[] }>("/api/tags");
  const fieldsQuery = useSWR<{ fields: BuilderData["fields"] }>("/api/fields");
  const flowsQuery = useSWR<{ flows: BuilderData["flows"] }>("/api/flows");
  const triggersQuery = useSWR<{ flow: FlowPayload }>(`/api/flows/${flow.id}`, { revalidateOnFocus: false });

  const builderData = useMemo<BuilderData>(
    () => ({
      flowId: flow.id,
      tags: tagsQuery.data?.tags ?? [],
      fields: fieldsQuery.data?.fields ?? [],
      flows: flowsQuery.data?.flows ?? [],
      triggers: triggersQuery.data?.flow.triggers ?? flow.triggers,
      problemNodes: new Set(issues.map((i) => i.nodeId).filter((id): id is string => !!id)),
      refreshTags: () => void tagsQuery.mutate(),
      refreshTriggers: () => void triggersQuery.mutate(),
    }),
    [flow.id, flow.triggers, tagsQuery, fieldsQuery.data, flowsQuery.data, triggersQuery, issues],
  );

  // ── Autosave ──
  const graph = useMemo(() => toGraph(nodes, edges), [nodes, edges]);
  const serialized = useMemo(() => JSON.stringify(graph), [graph]);
  const savedRef = useRef(JSON.stringify(toGraph(initial.nodes, initial.edges)));
  const latest = useRef({ graph, serialized });
  latest.current = { graph, serialized };
  const saving = useRef<Promise<boolean> | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    if (saving.current) await saving.current;
    const snapshot = latest.current;
    if (snapshot.serialized === savedRef.current) return true;
    setSaveState("saving");
    const run = (async () => {
      try {
        await api(`/api/flows/${flow.id}`, { method: "PATCH", body: { draft: snapshot.graph } });
        savedRef.current = snapshot.serialized;
        setUnpublished(true);
        setSaveError(null);
        setSaveState(latest.current.serialized === snapshot.serialized ? "saved" : "dirty");
        return true;
      } catch (err) {
        setSaveError(errorMessage(err));
        setSaveState("error");
        return false;
      }
    })();
    saving.current = run;
    const ok = await run;
    saving.current = null;
    return ok;
  }, [flow.id]);

  useEffect(() => {
    if (serialized === savedRef.current) return;
    setSaveState("dirty");
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [serialized, save]);

  // Warn before leaving with unsaved work.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (latest.current.serialized !== savedRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // ── Graph editing ──
  const addNode = useCallback(
    (kind: NodeKind, position: { x: number; y: number }, from?: { source: string; handle: string }) => {
      const id = newId();
      setNodes((current) => [
        ...current.map((n) => ({ ...n, selected: false })),
        { id, type: kind, position, data: defaultNodeData(kind) as Record<string, unknown>, selected: true },
      ]);
      if (from) {
        setEdges((current) => [
          ...current.filter((e) => !(e.source === from.source && (e.sourceHandle ?? HANDLE_NEXT) === from.handle)),
          { id: `e-${newId()}`, source: from.source, sourceHandle: from.handle, target: id, markerEnd: EDGE_MARKER, style: EDGE_STYLE },
        ]);
      }
      setIssues([]);
    },
    [setNodes, setEdges],
  );

  const addAtCenter = useCallback(
    (kind: NodeKind) => {
      const rect = wrapper.current?.getBoundingClientRect();
      if (!rect) return;
      const jitter = () => Math.round((Math.random() - 0.5) * 60);
      const position = screenToFlowPosition({ x: rect.left + rect.width / 2 + jitter(), y: rect.top + rect.height / 2 + jitter() });
      addNode(kind, { x: position.x - 136, y: position.y - 60 });
    },
    [screenToFlowPosition, addNode],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return;
      setEdges((current) =>
        addEdge(
          { ...connection, id: `e-${newId()}`, markerEnd: EDGE_MARKER, style: EDGE_STYLE },
          // Each connector leads to exactly one next step.
          current.filter((e) => !(e.source === connection.source && (e.sourceHandle ?? HANDLE_NEXT) === (connection.sourceHandle ?? HANDLE_NEXT))),
        ),
      );
      setIssues([]);
    },
    [setEdges],
  );

  // Dropping a connection on empty canvas offers to create the next step right there.
  const onConnectEnd = useCallback<OnConnectEnd>((event, state) => {
    if (state.isValid || !state.fromNode || state.fromHandle?.type !== "source") return;
    const target = event.target as HTMLElement | null;
    if (!target?.classList.contains("react-flow__pane")) return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    setPicker({ x: point.clientX, y: point.clientY, source: state.fromNode.id, handle: state.fromHandle.id ?? HANDLE_NEXT });
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/x-flow-step") as NodeKind;
      if (!ADDABLE.includes(kind)) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(kind, { x: position.x - 136, y: position.y - 30 });
    },
    [screenToFlowPosition, addNode],
  );

  const selected = nodes.filter((n) => n.selected);
  const active = selected.length === 1 ? selected[0] : null;

  const updateActive = useCallback(
    (data: Record<string, unknown>) => {
      if (!active) return;
      setNodes((current) => current.map((n) => (n.id === active.id ? { ...n, data } : n)));
      setIssues([]);
    },
    [active, setNodes],
  );

  const removeActive = useCallback(() => {
    if (!active || active.type === "trigger") return;
    setNodes((current) => current.filter((n) => n.id !== active.id));
    setEdges((current) => current.filter((e) => e.source !== active.id && e.target !== active.id));
  }, [active, setNodes, setEdges]);

  const duplicateActive = useCallback(() => {
    if (!active || active.type === "trigger") return;
    // Fresh ids for nested buttons / rules so connectors of the copy are independent.
    const clone = JSON.parse(JSON.stringify(active.data), (key, value) => (key === "id" && typeof value === "string" ? newId() : value)) as Record<string, unknown>;
    setNodes((current) => [
      ...current.map((n) => ({ ...n, selected: false })),
      { id: newId(), type: active.type, position: { x: active.position.x + 40, y: active.position.y + 60 }, data: clone, selected: true },
    ]);
  }, [active, setNodes]);

  // ── Top-bar actions ──
  async function rename(next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === flow.name) {
      setName(trimmed || flow.name);
      return;
    }
    try {
      await api(`/api/flows/${flow.id}`, { method: "PATCH", body: { name: trimmed } });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      if (!(await save())) throw new Error("Fix the save error before publishing.");
      await api(`/api/flows/${flow.id}/publish`, { method: "POST" });
      setStatus("PUBLISHED");
      setUnpublished(false);
      setIssues([]);
      toast("Flow published — it's live now");
    } catch (err) {
      if (err instanceof RequestError && err.status === 422 && Array.isArray(err.data?.issues)) {
        setIssues(err.data.issues as FlowIssue[]);
      } else {
        toast(errorMessage(err), "error");
      }
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish() {
    try {
      await api(`/api/flows/${flow.id}/unpublish`, { method: "POST" });
      setStatus("DRAFT");
      setUnpublished(true);
      toast("Flow unpublished");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function runPreview() {
    setPreviewBusy(true);
    try {
      if (!(await save())) throw new Error("Fix the save error before previewing.");
      const res = await api<{ url: string }>(`/api/flows/${flow.id}/preview`, { method: "POST" });
      // A unique query string restarts the chat even when the URL is otherwise the same.
      setPreviewUrl(`${res.url}&r=${Date.now()}`);
      setNodes((current) => current.map((n) => (n.selected ? { ...n, selected: false } : n)));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setPreviewBusy(false);
    }
  }

  function focusNode(id: string) {
    const node = getNode(id);
    if (!node) return;
    setNodes((current) => current.map((n) => ({ ...n, selected: n.id === id })));
    void setCenter(node.position.x + 136, node.position.y + 80, { zoom: 1, duration: 400 });
  }

  const statusBadge =
    status === "PUBLISHED" ? (
      unpublished ? (
        <Badge tone="amber">Unpublished changes</Badge>
      ) : (
        <Badge tone="green">Live</Badge>
      )
    ) : (
      <Badge>Draft</Badge>
    );

  return (
    <BuilderContext.Provider value={builderData}>
      <div className="fixed inset-0 z-[60] flex flex-col bg-canvas">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3">
          <Link href="/app/automation" aria-label="Back to Automation" className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink">
            <ArrowLeft className="size-5" />
          </Link>
          <input
            aria-label="Flow name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => void rename(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="min-w-0 max-w-[340px] flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-[15px] font-semibold text-ink outline-none hover:border-slate-200 focus:border-brand-500 focus:bg-white"
          />
          {statusBadge}
          <div className="flex-1" />
          <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex" aria-live="polite">
            {saveState === "saved" && (
              <>
                <Check className="size-3.5 text-mint-600" /> Saved
              </>
            )}
            {(saveState === "saving" || saveState === "dirty") && (
              <>
                <Spinner className="size-3.5" /> Saving…
              </>
            )}
            {saveState === "error" && (
              <button type="button" onClick={() => void save()} className="flex items-center gap-1.5 font-medium text-rose-600 hover:underline" title={saveError ?? undefined}>
                <CloudOff className="size-3.5" /> Not saved — retry
              </button>
            )}
          </span>
          <Button variant="secondary" icon={previewUrl ? <RotateCw className="size-4" /> : <Play className="size-4" />} loading={previewBusy} onClick={runPreview}>
            {previewUrl ? "Restart preview" : "Preview"}
          </Button>
          {status === "PUBLISHED" && !unpublished ? (
            <Button variant="secondary" onClick={unpublish}>
              Unpublish
            </Button>
          ) : (
            <Button loading={publishing} onClick={publish}>
              {status === "PUBLISHED" ? "Publish changes" : "Publish"}
            </Button>
          )}
        </header>

        <div className="relative flex min-h-0 flex-1">
          {/* Canvas */}
          <div ref={wrapper} className="relative min-w-0 flex-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              onPaneClick={() => setPicker(null)}
              isValidConnection={(c) => c.source !== c.target}
              deleteKeyCode={["Backspace", "Delete"]}
              minZoom={0.25}
              maxZoom={1.5}
              snapToGrid
              snapGrid={[10, 10]}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>

            {/* Step palette */}
            <aside className="absolute left-3 top-3 w-[212px] rounded-2xl border border-slate-200 bg-white p-2 shadow-card" aria-label="Add a step">
              <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Add a step</div>
              {ADDABLE.map((kind) => {
                const meta = NODE_META[kind];
                const Icon = meta.icon;
                return (
                  <button
                    key={kind}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-flow-step", kind);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => addAtCenter(kind)}
                    title={meta.description}
                    className="flex w-full cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100 active:cursor-grabbing"
                  >
                    <span className={clsx("flex size-7 shrink-0 items-center justify-center rounded-lg", meta.chip)}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    {meta.label}
                  </button>
                );
              })}
              <p className="px-2 pb-1 pt-2 text-[11px] leading-snug text-slate-400">Click or drag onto the canvas. Drag from a dot to connect steps.</p>
            </aside>

            {/* Publish problems */}
            {issues.length > 0 && (
              <div className="absolute bottom-4 left-1/2 w-[min(460px,calc(100%-32px))] -translate-x-1/2 rounded-2xl border border-rose-200 bg-white p-4 shadow-pop" role="alert">
                <div className="mb-2 flex items-center gap-2">
                  <CircleAlert className="size-4.5 text-rose-600" />
                  <span className="flex-1 text-sm font-semibold text-ink">
                    Fix {issues.length === 1 ? "this" : `these ${issues.length} things`} before publishing
                  </span>
                  <IconButton label="Dismiss" className="-mr-1.5 size-7" onClick={() => setIssues([])}>
                    <X className="size-4" />
                  </IconButton>
                </div>
                <ul className="scroll-thin max-h-40 space-y-1 overflow-y-auto">
                  {issues.map((issue, i) => (
                    <li key={i}>
                      {issue.nodeId ? (
                        <button type="button" onClick={() => focusNode(issue.nodeId!)} className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-slate-700 hover:bg-rose-50">
                          {issue.message} <span className="font-medium text-rose-600">Show</span>
                        </button>
                      ) : (
                        <span className="block px-2 py-1.5 text-[13px] text-slate-700">{issue.message}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* "What next?" menu after dropping a connection on empty canvas */}
            {picker && (
              <div
                className="fixed z-[70] w-[212px] animate-pop rounded-2xl border border-slate-200 bg-white p-2 shadow-pop"
                style={{ left: Math.min(picker.x, window.innerWidth - 230), top: Math.min(picker.y - 20, window.innerHeight - 330) }}
                role="menu"
              >
                <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Next step</span>
                  <button type="button" aria-label="Cancel" onClick={() => setPicker(null)} className="text-slate-400 hover:text-ink">
                    <X className="size-3.5" />
                  </button>
                </div>
                {ADDABLE.map((kind) => {
                  const meta = NODE_META[kind];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={kind}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const position = screenToFlowPosition({ x: picker.x, y: picker.y });
                        addNode(kind, { x: position.x, y: position.y - 27 }, { source: picker.source, handle: picker.handle });
                        setPicker(null);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <span className={clsx("flex size-7 shrink-0 items-center justify-center rounded-lg", meta.chip)}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            )}

            {nodes.length === 1 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
                <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-pop">
                  <Plus className="size-4" /> Add your first step from the panel on the left
                </div>
              </div>
            )}
          </div>

          {/* Step editor */}
          {active && (
            <aside className="flex w-[360px] shrink-0 flex-col border-l border-slate-200 bg-white" aria-label="Edit step">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
                <span className={clsx("flex size-7 items-center justify-center rounded-lg", NODE_META[active.type!].chip)}>
                  {(() => {
                    const Icon = NODE_META[active.type!].icon;
                    return <Icon className="size-4" aria-hidden />;
                  })()}
                </span>
                <h2 className="flex-1 font-sans text-sm font-semibold tracking-normal text-ink">{NODE_META[active.type!].label}</h2>
                {active.type !== "trigger" && (
                  <>
                    <IconButton label="Duplicate step" onClick={duplicateActive}>
                      <Copy className="size-4" />
                    </IconButton>
                    <IconButton label="Delete step" onClick={removeActive} className="hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="size-4" />
                    </IconButton>
                  </>
                )}
                <IconButton label="Close editor" onClick={() => setNodes((current) => current.map((n) => ({ ...n, selected: false })))}>
                  <X className="size-4.5" />
                </IconButton>
              </div>
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
                <NodeEditor key={active.id} kind={active.type!} data={active.data} onChange={updateActive} />
              </div>
            </aside>
          )}

          {/* Live preview */}
          {previewUrl && (
            <aside className="flex w-[380px] shrink-0 flex-col border-l border-slate-200 bg-slate-100" aria-label="Preview">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
                <h2 className="flex-1 font-sans text-sm font-semibold tracking-normal text-ink">Preview</h2>
                <span className="text-xs text-slate-500">Runs your draft</span>
                <IconButton label="Close preview" onClick={() => setPreviewUrl(null)}>
                  <X className="size-4.5" />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1 p-3">
                <iframe key={previewUrl} src={previewUrl} title="Flow preview" className="h-full w-full rounded-2xl border border-slate-200 bg-white shadow-card" />
              </div>
            </aside>
          )}
        </div>
      </div>
    </BuilderContext.Provider>
  );
}
