const normalizeOptionalString = (value: unknown) => {
  const normalized = String(value ?? '').trim()
  return normalized ? normalized : undefined
}

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => normalizeStringArray(entry))
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  const normalized = normalizeOptionalString(value)
  if (!normalized) return []

  return normalized
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const normalizeBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value

  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return Boolean(value)
}

const normalizePositiveInteger = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.trunc(parsed)
}

const normalizeQuestionOptions = (value: unknown) => {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (Array.isArray(entry) || typeof entry !== 'object' || entry === null) {
        const optionValues = normalizeStringArray(entry)
        return optionValues.length ? { value: optionValues } : null
      }

      const record = entry as Record<string, unknown>
      const optionValues = normalizeStringArray(record.value)
      if (!optionValues.length) return null

      return {
        ...record,
        value: optionValues,
      }
    })
    .filter(Boolean)
}

const normalizeQuestions = (value: unknown) => {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const questionId =
        normalizeOptionalString(record.questions_id) ||
        normalizeOptionalString(record.question_id) ||
        normalizeOptionalString(record.client_question_id)

      const type = normalizeOptionalString(record.type)
      const options =
        normalizeQuestionOptions(record.options).length > 0
          ? normalizeQuestionOptions(record.options)
          : normalizeStringArray(record.value).length > 0
            ? [{ value: normalizeStringArray(record.value) }]
            : []

      if (!questionId || !type || !options.length) return null

      return {
        ...record,
        questions_id: questionId,
        required: normalizeBoolean(record.required),
        type,
        options,
        ...(normalizeStringArray(record.ques_images).length > 0
          ? { ques_images: normalizeStringArray(record.ques_images) }
          : {}),
      }
    })
    .filter(Boolean)
}

const normalizeCustomQcItems = (value: unknown): Array<Record<string, unknown> & { questions: unknown[] }> => {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const description = normalizeOptionalString(record.description)
      const questions = normalizeQuestions(record.questions)

      if (!description || !questions.length) return null

      return {
        ...record,
        ...(normalizeOptionalString(record.item) ? { item: normalizeOptionalString(record.item) } : {}),
        description,
        images: normalizeStringArray(record.images),
        ...(normalizeOptionalString(record.return_reason)
          ? { return_reason: normalizeOptionalString(record.return_reason) }
          : {}),
        quantity: normalizePositiveInteger(record.quantity, 1),
        ...(normalizeOptionalString(record.brand)
          ? { brand: normalizeOptionalString(record.brand) }
          : {}),
        ...(normalizeOptionalString(record.product_category)
          ? { product_category: normalizeOptionalString(record.product_category) }
          : {}),
        questions,
      }
    })
    .filter(Boolean)

  return normalized as Array<Record<string, unknown> & { questions: unknown[] }>
}

export const resolveDelhiveryReverseQcPayload = (input: unknown) => {
  const record =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null

  const sourceItems = Array.isArray(input)
    ? input
    : Array.isArray(record?.custom_qc)
      ? record?.custom_qc
      : Array.isArray(record?.items)
        ? record?.items
        : []

  const customQc = normalizeCustomQcItems(sourceItems)

  if (!customQc.length) {
    return {
      qcType: undefined,
      customQc: [] as Array<Record<string, unknown>>,
      skippedReason: null as string | null,
    }
  }

  if (customQc.length > 2) {
    return {
      qcType: undefined,
      customQc: [] as Array<Record<string, unknown>>,
      skippedReason:
        'Delhivery RVP QC 3.0 supports a maximum of 2 items. QC payload was skipped.',
    }
  }

  if (customQc.some((item) => Array.isArray(item.questions) && item.questions.length > 6)) {
    return {
      qcType: undefined,
      customQc: [] as Array<Record<string, unknown>>,
      skippedReason:
        'Delhivery RVP QC 3.0 supports a maximum of 6 questions per item. QC payload was skipped.',
    }
  }

  return {
    qcType: 'param' as const,
    customQc,
    skippedReason: null as string | null,
  }
}
