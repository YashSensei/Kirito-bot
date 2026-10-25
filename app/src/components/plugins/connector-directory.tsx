import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { client } from "@/lib/client";
import { composioAppsQueryOptions, pluginKeys, pluginsPageQueryOptions } from "@/lib/plugins/queries";
import { PageSection } from "@/components/layout/page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PluginLogo } from "./plugin-logo";

export function ConnectorDirectory() {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(60);
  const queries = useQueryClient();
  const navigate = useNavigate();
  const directory = useQuery({...composioAppsQueryOptions("", "composio"), staleTime: 300_000});
  const plugins = useQuery(pluginsPageQueryOptions());
  const connect = useMutation({mutationFn: async (slug:string) => {
    const existing = plugins.data?.servers.find(server => server.url === `composio://${slug}`);
    if (existing) return existing.id;
    const r = await client("/api/plugins/composio/apps",{method:"POST",body:{slug}});
    return (await r.json()).server.id as string;
  },onSuccess:async id => {
    await queries.invalidateQueries({queryKey:pluginKeys.all});
    await navigate({to:"/connections/$key",params:{key:id}});
  }});
  const term = search.trim().toLowerCase();
  const apps = (directory.data?.apps??[]).filter(app=>`${app.name} ${app.slug} ${app.description}`.toLowerCase().includes(term));
  return <PageSection title="Explore connectors" description="Connect your apps so your bots can work with them.">
    <Input className="mt-5" aria-label="Search all connectors" placeholder="Search apps and tools…" value={search} onChange={e=>{setSearch(e.target.value);setLimit(60);}} />
    {directory.isPending?<p role="status" className="mt-4 text-sm text-muted-foreground">Loading available apps…</p>:directory.error?<p role="alert" className="mt-4 text-sm text-destructive">{directory.error.message}</p>:<p className="mt-3 text-xs text-muted-foreground">{apps.length.toLocaleString()} available connectors</p>}
    {connect.error&&<p role="alert" className="mt-3 text-sm text-destructive">{connect.error.message}</p>}
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{apps.slice(0,limit).map(app=><article key={app.slug} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-muted"><PluginLogo logo={app.logo}/></div><h3 className="truncate text-sm font-medium">{app.name}</h3></div><p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">{app.description}</p><Button size="sm" variant="outline" disabled={connect.isPending} onClick={()=>connect.mutate(app.slug)}>{connect.isPending&&connect.variables===app.slug?"Opening…":app.enabled?"Manage connection":"Connect"}</Button></article>)}</div>
    {apps.length>limit&&<Button variant="ghost" className="mt-4" onClick={()=>setLimit(limit+60)}>Show more</Button>}
  </PageSection>;
}
