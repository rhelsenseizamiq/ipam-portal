import React, { useState } from 'react';
import {
  Alert,
  Badge,
  Collapse,
  Drawer,
  Input,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  LockOutlined,
  TeamOutlined,
  EyeOutlined,
  EditOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  TagsOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface Section {
  key: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  content: React.ReactNode;
}

const RoleBadge = ({ role }: { role: 'Viewer' | 'Operator' | 'Administrator' }) => {
  const color = role === 'Administrator' ? 'red' : role === 'Operator' ? 'blue' : 'default';
  return <Tag color={color} style={{ fontSize: 11 }}>{role}+</Tag>;
};

const VAULT_SECTIONS: Section[] = [
  {
    key: 'overview',
    icon: <LockOutlined />,
    title: 'Password Vault Overview',
    content: (
      <>
        <Paragraph>
          The <Text strong>Password Vault</Text> is a secure, team-shared credential store. Each team gets its own <Text strong>Cabinet</Text> — an isolated vault where only members can see and manage credentials.
        </Paragraph>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>Every password is encrypted at rest with <Text strong>AES-256-GCM</Text> before being saved to the database</li>
          <li>Each cabinet uses a <Text strong>unique cryptographic key</Text> derived from a master key — one cabinet's data cannot be used to decrypt another's</li>
          <li>Plaintext passwords are <Text strong>never stored</Text> — they exist in memory only for the instant of encryption or decryption</li>
          <li>The browser never receives ciphertext or encryption keys — only the decrypted value when you explicitly click <Text strong>Reveal</Text></li>
        </ul>
        <Alert
          type="success"
          showIcon
          style={{ fontSize: 12 }}
          message="Passwords are encrypted per-cabinet using HKDF-SHA256 key derivation + AES-256-GCM authenticated encryption."
        />
      </>
    ),
  },
  {
    key: 'cabinets',
    icon: <TeamOutlined />,
    title: 'Cabinets & Membership',
    content: (
      <>
        <Paragraph>
          A <Text strong>Cabinet</Text> is a named team group (e.g. "Linux Admins", "DBA Team"). All password entries belong to exactly one cabinet.
        </Paragraph>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>Only <RoleBadge role="Administrator" /> can create, rename, or delete cabinets</li>
          <li>Administrators assign <Text strong>members</Text> to cabinets — only members can view the entries inside</li>
          <li>A user can be a member of multiple cabinets</li>
          <li>Deleting a cabinet permanently deletes <Text strong>all its entries</Text> — this cannot be undone</li>
        </ul>
        <Alert
          type="warning"
          showIcon
          style={{ fontSize: 12 }}
          message="Even Administrators cannot read passwords unless they are explicitly added as cabinet members."
        />
      </>
    ),
  },
  {
    key: 'entries',
    icon: <KeyOutlined />,
    title: 'Password Entries',
    content: (
      <>
        <Paragraph>
          Each <Text strong>entry</Text> inside a cabinet stores one set of credentials. Fields:
        </Paragraph>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li><Text strong>Title</Text> (required) — a short label, e.g. "Production DB root"</li>
          <li><Text strong>Username</Text> — the account name or login</li>
          <li><Text strong>Password</Text> — encrypted before saving; revealed only on demand</li>
          <li><Text strong>URL</Text> — optional link to the service (opens in new tab)</li>
          <li><Text strong>Notes</Text> — free-form text, up to 5000 characters</li>
          <li><Text strong>Tags</Text> — up to 20 labels for filtering (e.g. "linux", "prod", "ssh")</li>
        </ul>
        <Paragraph>
          Creating and editing entries requires <RoleBadge role="Operator" /> or higher <Text strong>and</Text> cabinet membership.
        </Paragraph>
      </>
    ),
  },
  {
    key: 'reveal',
    icon: <EyeOutlined />,
    title: 'Reveal & Copy',
    content: (
      <>
        <Paragraph>
          Passwords are hidden by default. Click <Text strong>Reveal</Text> on any row to decrypt and display the password.
        </Paragraph>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>
            <ClockCircleOutlined /> The revealed password <Text strong>auto-hides after 30 seconds</Text> — a countdown is shown
          </li>
          <li>
            <CopyOutlined /> Click the copy icon to copy the password to your clipboard instantly
          </li>
          <li>You can also click the <EyeOutlined /> hide button to clear it immediately</li>
          <li>Every reveal is <Text strong>audit-logged</Text> with your username, timestamp, and IP address</li>
          <li>The reveal endpoint has a <Text strong>rate limit of 10 reveals per minute</Text> per user</li>
        </ul>
        <Alert
          type="info"
          showIcon
          style={{ fontSize: 12 }}
          message="Reveal responses include Cache-Control: no-store — the password is never saved in browser history or cache."
        />
      </>
    ),
  },
  {
    key: 'tags',
    icon: <TagsOutlined />,
    title: 'Tags',
    content: (
      <>
        <Paragraph>
          Tags are short labels you attach to entries for organisation and quick identification.
        </Paragraph>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>Click <Text strong>+ New Tag</Text> in the entry form to type a tag and press <Text code>Enter</Text></li>
          <li>Tags appear as coloured chips — click the <Text strong>✕</Text> on any chip to remove it</li>
          <li>Maximum <Text strong>20 tags</Text> per entry, each up to <Text strong>50 characters</Text></li>
          <li>Tags are visible in the entries table and can be used to identify entry type at a glance</li>
        </ul>
        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          Example tags: <Tag>ssh</Tag> <Tag>prod</Tag> <Tag>linux</Tag> <Tag>api-key</Tag> <Tag>shared</Tag>
        </Paragraph>
      </>
    ),
  },
  {
    key: 'roles',
    icon: <SafetyCertificateOutlined />,
    title: 'Vault Roles & Permissions',
    content: (
      <>
        <Paragraph>Access in the vault is controlled by both <Text strong>role</Text> and <Text strong>cabinet membership</Text>:</Paragraph>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>
            <Space size={4}>
              <EyeOutlined style={{ color: '#8c8c8c' }} />
              <Text strong>Viewer</Text>
            </Space>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Can view and reveal passwords in cabinets they are a member of. Cannot create or edit entries.
            </Text>
          </li>
          <li style={{ marginTop: 8 }}>
            <Space size={4}>
              <EditOutlined style={{ color: '#1677ff' }} />
              <Text strong>Operator</Text>
            </Space>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              All Viewer permissions plus: create, edit, and delete entries in cabinets they are a member of.
            </Text>
          </li>
          <li style={{ marginTop: 8 }}>
            <Space size={4}>
              <LockOutlined style={{ color: '#ff4d4f' }} />
              <Text strong>Administrator</Text>
            </Space>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Can create, rename, delete cabinets and manage membership. To access passwords, must also be a cabinet member.
            </Text>
          </li>
        </ul>
        <Alert
          type="warning"
          showIcon
          style={{ fontSize: 12 }}
          message="Administrator role grants cabinet management only — not automatic access to passwords inside. Membership is required."
        />
      </>
    ),
  },
  {
    key: 'audit',
    icon: <AuditOutlined />,
    title: 'Audit Trail',
    content: (
      <>
        <Paragraph>
          Every sensitive action in the vault is <Text strong>immutably logged</Text> in the audit trail:
        </Paragraph>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li><Tag color="green">CREATE</Tag> — new cabinet or entry created</li>
          <li><Tag color="blue">UPDATE</Tag> — cabinet renamed, members changed, entry edited</li>
          <li><Tag color="red">DELETE</Tag> — cabinet or entry deleted (including cascade)</li>
          <li><Tag color="purple">REVEAL</Tag> — password decrypted and shown to a user</li>
        </ul>
        <Paragraph>
          Each log entry records: <Text strong>who</Text> performed the action, <Text strong>when</Text>, from <Text strong>which IP</Text>, and what <Text strong>resource</Text> was affected.
        </Paragraph>
        <Alert
          type="info"
          showIcon
          style={{ fontSize: 12 }}
          message="Ciphertext and encryption IVs are never written to audit logs — only metadata (titles, cabinet names, usernames)."
        />
      </>
    ),
  },
  {
    key: 'delete',
    icon: <DeleteOutlined />,
    title: 'Deleting Entries & Cabinets',
    content: (
      <>
        <Paragraph>
          Deletion is <Text strong>permanent and irreversible</Text> — there is no recycle bin or undo.
        </Paragraph>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li>Deleting an <Text strong>entry</Text> removes it and its encrypted ciphertext from the database permanently</li>
          <li>Deleting a <Text strong>cabinet</Text> cascades — all entries inside are also deleted</li>
          <li>Both actions are protected by a confirmation prompt</li>
          <li>Deletion requires <RoleBadge role="Operator" /> for entries, <RoleBadge role="Administrator" /> for cabinets</li>
        </ul>
        <Alert
          type="error"
          showIcon
          style={{ fontSize: 12 }}
          message="Once a cabinet is deleted, its passwords cannot be recovered — there is no backup mechanism in the UI."
        />
      </>
    ),
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

const VaultHelpDrawer: React.FC<Props> = ({ open, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? VAULT_SECTIONS.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.key.toLowerCase().includes(search.toLowerCase())
      )
    : VAULT_SECTIONS;

  return (
    <Drawer
      title="Password Manager — Concepts & Help"
      open={open}
      onClose={() => {
        setSearch('');
        onClose();
      }}
      width={540}
      styles={{ body: { paddingTop: 12 } }}
    >
      <Input
        prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
        placeholder="Search topics…"
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
      />

      {filtered.length === 0 ? (
        <Typography.Text type="secondary">No topics match "{search}"</Typography.Text>
      ) : (
        <Collapse
          accordion={false}
          defaultActiveKey={['overview']}
          expandIconPosition="end"
          items={filtered.map((section) => ({
            key: section.key,
            label: (
              <Space size={8}>
                <span style={{ color: '#52c41a', fontSize: 15 }}>{section.icon}</span>
                <Typography.Text strong style={{ fontSize: 14 }}>{section.title}</Typography.Text>
                {section.badge && (
                  <Badge
                    count={section.badge}
                    style={{ backgroundColor: '#52c41a', fontSize: 10, height: 16, lineHeight: '16px', padding: '0 5px' }}
                  />
                )}
              </Space>
            ),
            children: <Typography>{section.content}</Typography>,
          }))}
        />
      )}
    </Drawer>
  );
};

export default VaultHelpDrawer;
