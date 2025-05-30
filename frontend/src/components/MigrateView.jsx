import React from "react";
import { useIntl } from "react-intl";
import { useApi } from "../api/ApiContext";

const MigrateView = () => {
  const intl = useIntl();
  const { apiProviderType, dbVersion, appMajor } = useApi();

  return (
    <div className="settings-view">
      <h2>{intl.formatMessage({ id: "migrate.title" })}</h2>
      <p>
        {intl.formatMessage(
          { id: "migrate.versionInfo" },
          { dbVersion, appVersion: appMajor }
        )}
      </p>
      {apiProviderType === "indexedDB" ? (
        <p>{intl.formatMessage({ id: "migrate.description.indexedDB" })}</p>
      ) : (
        <p>{intl.formatMessage({ id: "migrate.description.exportImport" })}</p>
      )}
    </div>
  );
};

export default MigrateView;
