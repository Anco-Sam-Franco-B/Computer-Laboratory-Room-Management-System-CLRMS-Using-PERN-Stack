import { useEffect, useState } from 'react';
import { FileText, Download, Table2, FileSpreadsheet, File } from 'lucide-react';
import { api, extractError } from '../../lib/api';
import { downloadReport } from '../../hooks/useApiList';
import { toast } from '../../stores/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import Field from '../../components/ui/Field';
import { Input, Select } from '../../components/ui/Input';
import Table from '../../components/ui/Table';
import Spinner from '../../components/ui/Spinner';
import { useAuthStore } from '../../stores/authStore';
import { REPORT_TYPES } from '../../lib/constants';

export default function Reports() {
  const user = useAuthStore((s) => s.user);
  const [type, setType] = useState(REPORT_TYPES[0].type);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [labs, setLabs] = useState([]);
  const [laboratoryId, setLaboratoryId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    api.get('/laboratories?limit=100').then((r) => setLabs(r.data.data)).catch(() => {});
  }, []);

  const build = async () => {
    setLoading(true);
    try {
      const params = { type };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (laboratoryId) params.laboratoryId = laboratoryId;
      if (params.type !== 'utilization' && params.type !== 'assets') params.status = params.status;
      const res = await api.get(`/reports/${params.type}`, { params });
      setData(res.data.data);
    } catch (e) { toast.error(extractError(e)); setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { build(); }, []);

  const doExport = async (format, label) => {
    setExporting(format);
    try {
      await downloadReport(type, format, {
        fromDate: fromDate || undefined, toDate: toDate || undefined, laboratoryId: laboratoryId || undefined,
      });
      toast.success(`${label} downloaded.`);
    } catch (e) { toast.error(e.message || 'Export failed'); }
    finally { setExporting(null); }
  };

  const formatCell = (row, col) => {
    const value = row[col.key] ?? row[col.key.toLowerCase()];
    if (value === null || value === undefined || value === '') return '—';
    if (col.format === 'date' && value) return new Date(value).toLocaleDateString();
    if (col.format === 'currency') return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value));
    if (col.format === 'bool') return value ? 'Yes' : 'No';
    return String(value);
  };

  const columns = (data?.columns || []).map((c) => ({ key: c.toLowerCase(), label: c, format: c.toLowerCase().includes('date') ? 'date' : c.toLowerCase().includes('cost') || c.toLowerCase().includes('price') ? 'currency' : undefined }));

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and export operational reports" icon={<FileText size={20} />} />

      <div className="card mb-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Report type">
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {REPORT_TYPES.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="From date"><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Field>
          <Field label="To date"><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></Field>
          <Field label="Laboratory">
            <Select value={laboratoryId} onChange={(e) => setLaboratoryId(e.target.value)}>
              <option value="">All laboratories</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <button className="btn-primary" onClick={build}><Table2 size={15} /> Run report</button>
          <button className="btn-secondary" onClick={() => doExport('csv', 'CSV')} disabled={!!exporting}><File size={15} /> CSV</button>
          <button className="btn-secondary" onClick={() => doExport('excel', 'Excel')} disabled={!!exporting}><FileSpreadsheet size={15} /> Excel</button>
          <button className="btn-secondary" onClick={() => doExport('pdf', 'PDF')} disabled={!!exporting}><FileText size={15} /> PDF</button>
          {exporting && <span className="text-sm text-slate-400">Exporting… <Spinner size={14} /></span>}
        </div>
      </div>

      {data && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-surface-700">
            <p className="font-semibold">{data.title}</p>
            <p className="text-xs text-slate-400">{data.rows.length} rows</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size={28} /></div>
          ) : (
            <Table loading={loading} columns={columns} rows={data.rows.map((r) => {
              const out = {};
              columns.forEach((c) => { out[c.key] = formatCell(r, c); });
              return out;
            })} empty="No data for this report." />
          )}
        </div>
      )}
    </div>
  );
}