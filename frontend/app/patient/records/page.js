"use client";

import { useEffect, useRef, useState } from "react";
import PortalShell from "../../../components/PortalShell";
import { EmptyState, fmtDate } from "../../../components/ui";
import { api } from "../../../lib/api";

const CATEGORY_LABEL = {
  "lab-result": "Lab result",
  imaging: "Imaging",
  prescription: "Prescription",
  "clinical-note": "Clinical note",
  other: "Other",
};

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function validateFile(file) {
  if (!file) {
    return "Please select a file to upload.";
  }

  const filename = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((extension) =>
    filename.endsWith(extension)
  );

  if (!hasAllowedExtension || !ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Unsupported file. Choose a PDF, JPG, JPEG, or PNG file.";
  }

  if (file.size === 0) {
    return "The selected file is empty.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "The file exceeds the 10 MB upload limit.";
  }

  return "";
}

export default function PatientRecords() {
  const [records, setRecords] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(true);

  const fileInputRef = useRef(null);

  async function loadRecords() {
    setLoadingRecords(true);

    try {
      const result = await api.getPatientRecords();
      setRecords(result);
    } catch (err) {
      setError(err.message || "Could not load your medical records.");
    } finally {
      setLoadingRecords(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    setFile(selectedFile);
    setError("");
    setSuccess("");

    if (selectedFile) {
      const validationError = validateFile(selectedFile);

      if (validationError) {
        setError(validationError);
        setFile(null);
        event.target.value = "";
      }
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // This API method must send multipart/form-data using the field
      // name "document", plus the title and category fields.
      await api.uploadOwnRecord(file, { title: title.trim(), category });

      setTitle("");
      setCategory("other");
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setSuccess("Medical record uploaded successfully.");
      await loadRecords();
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalShell
      role="patient"
      eyebrow="Patient Portal"
      title="Medical records"
      subtitle="Your records are encrypted off-chain; their hashes can be recorded on-chain for tamper checks."
    >
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Upload a medical record</h3>

        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Supported formats: PDF, JPG, JPEG, and PNG. Maximum file size: 10 MB.
        </p>

        <form onSubmit={handleUpload}>
          <div className="field">
            <label htmlFor="record-title">Record title</label>
            <input
              id="record-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="e.g. Blood test report"
            />
          </div>

          <div className="field">
            <label htmlFor="record-category">Category</label>
            <select
              id="record-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="record-file">Choose file</label>
            <input
              ref={fileInputRef}
              id="record-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleFileChange}
              disabled={loading}
              style={{ width: "100%" }}
            />

            {file && (
              <div className="field-hint">
                Selected: {file.name} (
                {(file.size / (1024 * 1024)).toFixed(2)} MB)
              </div>
            )}
          </div>

          {error && (
            <div className="error-text" role="alert" style={{ marginBottom: 12 }}>
              {error}
            </div>
          )}

          {success && (
            <p role="status" style={{ color: "var(--primary)", fontSize: 13 }}>
              {success}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Uploading…" : "Upload record"}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Your records</h3>

        {loadingRecords && (
          <p style={{ color: "var(--muted)" }}>Loading records…</p>
        )}

        {!loadingRecords && records && records.length === 0 && (
          <EmptyState
            title="No records yet"
            body="Upload your first medical record using the form above."
          />
        )}

        {!loadingRecords && records && records.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Title</th>
                <th>File</th>
                <th>Date</th>
                <th>Chain status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td style={{ fontWeight: 600 }}>
                    {CATEGORY_LABEL[record.category] ||
                      record.category ||
                      "—"}
                  </td>

                  <td>{record.title || "—"}</td>

                  <td style={{ color: "var(--muted)" }}>
                    {record.originalFilename}
                  </td>

                  <td style={{ color: "var(--muted)" }}>
                    {fmtDate(record.createdAt)}
                  </td>

                  <td style={{ textTransform: "capitalize" }}>
                    {record.blockchainStatus || "Not registered"}
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        setError("");

                        try {
                          await api.downloadOwnRecord(
                            record.id,
                            record.originalFilename
                          );
                        } catch (err) {
                          setError(
                            err.message || "Could not download this record."
                          );
                        }
                      }}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
