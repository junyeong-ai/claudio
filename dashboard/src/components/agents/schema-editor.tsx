'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { JsonSchema } from '@/types/api';

interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description?: string;
  enum?: string[];
  items?: { type: string };
}

interface SchemaEditorProps {
  schema: JsonSchema | null;
  onChange: (schema: JsonSchema | null) => void;
}

const SCHEMA_TEMPLATES: Record<string, { name: string; schema: JsonSchema }> = {
  'code-review': {
    name: 'Code Review',
    schema: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['approve', 'request_changes', 'comment'] },
        summary: { type: 'string' },
        points: { type: 'array', items: { type: 'string' } },
      },
      required: ['verdict', 'summary'],
    },
  },
  'auto-fix': {
    name: 'Auto Fix',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        autoFixed: { type: 'boolean' },
        branchName: { type: 'string' },
        mrUrl: { type: 'string' },
        summary: { type: 'string' },
        error: { type: 'string' },
      },
      required: ['success', 'autoFixed', 'summary'],
    },
  },
  'context-summary': {
    name: 'Context Summary',
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        rules: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary', 'rules'],
    },
  },
  'jira-ticket': {
    name: 'JIRA Ticket',
    schema: {
      type: 'object',
      properties: {
        jiraKey: { type: 'string' },
        jiraTitle: { type: 'string' },
        jiraUrl: { type: 'string' },
      },
      required: ['jiraKey', 'jiraTitle'],
    },
  },
  'incident-analysis': {
    name: 'Incident Analysis',
    schema: {
      type: 'object',
      properties: {
        slack_report: { type: 'string' },
        jira_title: { type: 'string' },
        can_auto_fix: { type: 'boolean' },
        priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
      },
      required: ['slack_report', 'can_auto_fix', 'priority'],
    },
  },
};

function parseSchemaToFields(schema: JsonSchema | null): SchemaField[] {
  if (!schema || schema.type !== 'object' || !schema.properties) return [];

  const props = schema.properties as Record<string, Record<string, unknown>>;
  const required = (schema.required as string[]) || [];

  return Object.entries(props).map(([name, prop]) => ({
    name,
    type: (prop.type as SchemaField['type']) || 'string',
    required: required.includes(name),
    description: prop.description as string | undefined,
    enum: prop.enum as string[] | undefined,
    items: prop.items as { type: string } | undefined,
  }));
}

function fieldsToSchema(fields: SchemaField[]): JsonSchema | null {
  if (fields.length === 0) return null;

  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const field of fields) {
    const prop: Record<string, unknown> = { type: field.type };
    if (field.description) prop.description = field.description;
    if (field.enum && field.enum.length > 0) prop.enum = field.enum;
    if (field.type === 'array' && field.items) prop.items = field.items;
    properties[field.name] = prop;
    if (field.required) required.push(field.name);
  }

  return { type: 'object', properties, required };
}

function FieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: SchemaField;
  onChange: (field: SchemaField) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [enumInput, setEnumInput] = useState('');

  const addEnum = () => {
    const trimmed = enumInput.trim();
    if (trimmed && !field.enum?.includes(trimmed)) {
      onChange({ ...field, enum: [...(field.enum || []), trimmed] });
      setEnumInput('');
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-muted rounded"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Input
          value={field.name}
          onChange={(e) => onChange({ ...field, name: e.target.value })}
          placeholder="field_name"
          className="flex-1 h-8 font-mono text-sm"
        />
        <Select
          value={field.type}
          onValueChange={(v) => onChange({ ...field, type: v as SchemaField['type'] })}
        >
          <SelectTrigger className="w-28 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="string">string</SelectItem>
            <SelectItem value="number">number</SelectItem>
            <SelectItem value="boolean">boolean</SelectItem>
            <SelectItem value="array">array</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Checkbox
            id={`req-${field.name}`}
            checked={field.required}
            onCheckedChange={(c) => onChange({ ...field, required: c === true })}
          />
          <Label htmlFor={`req-${field.name}`} className="text-xs text-muted-foreground">
            required
          </Label>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>

      {expanded && (
        <div className="pl-8 space-y-3">
          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={field.description || ''}
              onChange={(e) => onChange({ ...field, description: e.target.value || undefined })}
              placeholder="Field description"
              className="h-8 mt-1"
            />
          </div>

          {field.type === 'string' && (
            <div>
              <Label className="text-xs">Enum Values</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={enumInput}
                  onChange={(e) => setEnumInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEnum())}
                  placeholder="Add enum value"
                  className="h-8"
                />
                <Button type="button" variant="outline" size="sm" onClick={addEnum}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {field.enum && field.enum.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {field.enum.map((v) => (
                    <Badge key={v} variant="secondary" className="gap-1 pr-1">
                      {v}
                      <button
                        type="button"
                        onClick={() => onChange({ ...field, enum: field.enum?.filter((e) => e !== v) })}
                        className="ml-0.5 hover:bg-foreground/20 rounded-full p-0.5"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {field.type === 'array' && (
            <div>
              <Label className="text-xs">Array Item Type</Label>
              <Select
                value={field.items?.type || 'string'}
                onValueChange={(v) => onChange({ ...field, items: { type: v } })}
              >
                <SelectTrigger className="w-32 h-8 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="number">number</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SchemaEditor({ schema, onChange }: SchemaEditorProps) {
  const [mode, setMode] = useState<'visual' | 'json'>('visual');
  const [jsonText, setJsonText] = useState(() =>
    schema ? JSON.stringify(schema, null, 2) : ''
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const fields = useMemo(() => parseSchemaToFields(schema), [schema]);

  const updateFields = useCallback(
    (newFields: SchemaField[]) => {
      const newSchema = fieldsToSchema(newFields);
      onChange(newSchema);
      if (newSchema) {
        setJsonText(JSON.stringify(newSchema, null, 2));
      } else {
        setJsonText('');
      }
    },
    [onChange]
  );

  const addField = () => {
    const newField: SchemaField = {
      name: `field${fields.length + 1}`,
      type: 'string',
      required: false,
    };
    updateFields([...fields, newField]);
  };

  const updateField = (index: number, field: SchemaField) => {
    const newFields = [...fields];
    newFields[index] = field;
    updateFields(newFields);
  };

  const removeField = (index: number) => {
    updateFields(fields.filter((_, i) => i !== index));
  };

  const applyTemplate = (templateKey: string) => {
    const template = SCHEMA_TEMPLATES[templateKey];
    if (template) {
      onChange(template.schema);
      setJsonText(JSON.stringify(template.schema, null, 2));
    }
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    if (!text.trim()) {
      setJsonError(null);
      onChange(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      onChange(parsed);
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  const clearSchema = () => {
    onChange(null);
    setJsonText('');
    setJsonError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Braces className="h-4 w-4 text-muted-foreground" />
          <Label>Output Schema</Label>
          {schema && (
            <Badge variant="secondary" className="text-xs">
              {Object.keys((schema.properties as Record<string, unknown>) || {}).length} fields
            </Badge>
          )}
        </div>
        {schema && (
          <Button variant="ghost" size="sm" onClick={clearSchema} className="text-xs">
            Clear Schema
          </Button>
        )}
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'visual' | 'json')}>
        <div className="flex items-center justify-between">
          <TabsList className="h-8">
            <TabsTrigger value="visual" className="text-xs px-3">Visual</TabsTrigger>
            <TabsTrigger value="json" className="text-xs px-3">JSON</TabsTrigger>
          </TabsList>
          <Select onValueChange={applyTemplate}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue placeholder="Templates" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SCHEMA_TEMPLATES).map(([key, { name }]) => (
                <SelectItem key={key} value={key}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="visual" className="space-y-3 mt-3">
          {fields.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Braces className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mt-2">No schema defined</p>
              <p className="text-xs text-muted-foreground">Agent will return natural language</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={addField}>
                <Plus className="h-3 w-3 mr-1" /> Add Field
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <FieldEditor
                    key={index}
                    field={field}
                    onChange={(f) => updateField(index, f)}
                    onRemove={() => removeField(index)}
                  />
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addField} className="w-full">
                <Plus className="h-3 w-3 mr-1" /> Add Field
              </Button>
            </>
          )}
        </TabsContent>

        <TabsContent value="json" className="mt-3">
          <Textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            placeholder='{"type": "object", "properties": {...}}'
            className="font-mono text-sm min-h-[200px]"
          />
          {jsonError && (
            <p className="text-xs text-destructive mt-1">{jsonError}</p>
          )}
        </TabsContent>
      </Tabs>

      {schema && (
        <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
          <strong>Preview:</strong>
          <pre className="mt-1 overflow-auto max-h-24">
            {JSON.stringify(
              Object.fromEntries(
                Object.entries((schema.properties as Record<string, Record<string, unknown>>) || {}).map(
                  ([k, v]) => {
                    const enumValues = v.enum as string[] | undefined;
                    return [k, enumValues ? enumValues[0] : v.type === 'array' ? ['...'] : v.type === 'boolean' ? true : v.type === 'number' ? 0 : '...'];
                  }
                )
              ),
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
