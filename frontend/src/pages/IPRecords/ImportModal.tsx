import React, { useState } from 'react';
import {
  Modal,
  Upload,
  Button,
  Space,
  Typography,
  Alert,
  Table,
  message,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { ipRecordsApi, type ImportResult } from '../../api/ipRecords';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const ImportModal: React.FC<Props> = ({ open, onClose, onImported }) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  const reset = (): void => {
    setFileList([]);
    setResult(null);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const handleDownloadTemplate = async (): Promise<void> => {
    setTemplateLoading(true);
    try {
      await ipRecordsApi.downloadTemplate();
    } catch {
      message.error('Failed to download template');
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleImport = async (): Promise<void> => {
    if (fileList.length === 0 || !fileList[0].originFileObj) {
      message.warning('Please select a CSV file first');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await ipRecordsApi.importRecords(fileList[0].originFileObj);
      setResult(res.data);
      if (res.data.imported > 0) {
        onImported();
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      message.error(axiosErr.response?.data?.detail ?? axiosErr.message ?? 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const errorColumns = [
    { title: 'Row', dataIndex: 'row', key: 'row', width: 60 },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 130 },
    { title: 'Error', dataIndex: 'error', key: 'error' },
  ];

  return (
    <Modal
      title="Import IP Records from CSV"
      open={open}
      onCancel={handleClose}
      width={600}
      destroyOnClose
      footer={
        result ? (
          <Space>
            <Button onClick={handleClose}>Close</Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={loading}
              disabled={fileList.length === 0}
              onClick={() => void handleImport()}
            >
              Import
            </Button>
          </Space>
        )
      }
    >
      {/* Step 1 — Template */}
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <div>
          <Typography.Text strong>Step 1 — Download the template</Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Fill in the CSV and upload it below. Required columns:{' '}
            <code>ip_address, os_type, subnet_cidr, environment</code>
          </Typography.Text>
          <br />
          <Button
            icon={<DownloadOutlined />}
            size="small"
            style={{ marginTop: 8 }}
            loading={templateLoading}
            onClick={() => void handleDownloadTemplate()}
          >
            ipam_import_template.csv
          </Button>
        </div>

        {/* Step 2 — Upload */}
        {!result && (
          <div>
            <Typography.Text strong>Step 2 — Upload your filled CSV</Typography.Text>
            <Upload.Dragger
              accept=".csv"
              maxCount={1}
              fileList={fileList}
              beforeUpload={() => false}  // prevent auto-upload
              onChange={({ fileList: fl }) => setFileList(fl)}
              style={{ marginTop: 8 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag a CSV file here</p>
              <p className="ant-upload-hint">Only .csv files are accepted</p>
            </Upload.Dragger>
          </div>
        )}

        {/* Result */}
        {result && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Alert
              type={result.errors.length === 0 ? 'success' : 'warning'}
              message={
                result.errors.length === 0
                  ? `All ${result.imported} record(s) imported successfully.`
                  : `${result.imported} record(s) imported, ${result.errors.length} row(s) failed.`
              }
              showIcon
            />
            {result.errors.length > 0 && (
              <>
                <Typography.Text strong type="danger">
                  Rows with errors:
                </Typography.Text>
                <Table
                  dataSource={result.errors}
                  columns={errorColumns}
                  rowKey="row"
                  size="small"
                  pagination={false}
                  scroll={{ y: 200 }}
                />
              </>
            )}
          </Space>
        )}
      </Space>
    </Modal>
  );
};

export default ImportModal;
