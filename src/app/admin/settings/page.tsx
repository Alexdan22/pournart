import { updateSettingsAction } from "@/app/actions/admin";
import { defaultStoreSettings, ensureDefaultSettings, providerStatus } from "@/lib/admin-data";
import { prisma } from "@/lib/db";

export default async function AdminSettingsPage() {
  await ensureDefaultSettings();
  const [settings, status] = await Promise.all([
    prisma.storeSetting.findMany({ orderBy: [{ group: "asc" }, { label: "asc" }] }),
    Promise.resolve(providerStatus()),
  ]);
  const valueByKey = new Map(settings.map((setting) => [setting.key, setting.value]));
  const groups = [...new Set(defaultStoreSettings.map((setting) => setting.group))];

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Settings</span>
          <h1>Store configuration</h1>
        </div>
      </div>
      <div className="admin-stat-row provider-status-row">
        <span className={status.resend ? "ok" : "missing"}><strong>{status.resend ? "Configured" : "Missing"}</strong>Resend</span>
        <span className={status.razorpay ? "ok" : "missing"}><strong>{status.razorpay ? "Configured" : "Missing"}</strong>Razorpay</span>
        <span className={status.razorpayWebhook ? "ok" : "missing"}><strong>{status.razorpayWebhook ? "Configured" : "Missing"}</strong>Razorpay Webhook</span>
        <span className={status.queueSecret ? "ok" : "missing"}><strong>{status.queueSecret ? "Configured" : "Missing"}</strong>Email Queue Secret</span>
      </div>
      <form className="settings-grid" action={updateSettingsAction}>
        {groups.map((group) => (
          <section className="admin-panel" key={group}>
            <div className="admin-panel-heading"><h2>{group}</h2></div>
            {defaultStoreSettings.filter((setting) => setting.group === group).map((setting) => (
              <label key={setting.key}>
                <span>{setting.label}</span>
                {setting.valueType === "textarea" ? (
                  <textarea name={setting.key} defaultValue={valueByKey.get(setting.key) ?? setting.value} />
                ) : (
                  <input name={setting.key} type={setting.valueType} defaultValue={valueByKey.get(setting.key) ?? setting.value} />
                )}
              </label>
            ))}
          </section>
        ))}
        <div className="settings-submit">
          <button className="admin-button primary" type="submit">Save settings</button>
        </div>
      </form>
    </section>
  );
}
