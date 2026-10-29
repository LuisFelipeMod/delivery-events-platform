{{- define "delivery.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{- define "delivery.databaseUrl" -}}
{{- if .Values.postgres.enabled -}}
{{- printf "postgres://%s:%s@%s-postgres:5432/%s" .Values.postgres.user .Values.postgres.password (include "delivery.fullname" .) .Values.postgres.database -}}
{{- else -}}
{{- .Values.orders.databaseUrl -}}
{{- end -}}
{{- end }}

{{- define "delivery.orders.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: orders
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "delivery.orders.selector" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: orders
{{- end }}

{{- define "delivery.fulfillment.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: fulfillment
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "delivery.fulfillment.selector" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: fulfillment
{{- end }}

{{- define "delivery.postgres.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: postgres
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "delivery.postgres.selector" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: postgres
{{- end }}
