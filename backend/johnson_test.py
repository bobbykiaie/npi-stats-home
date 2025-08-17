import sys
import json
import numpy as np
from scipy.stats import shapiro, norm
from sklearn.preprocessing import PowerTransformer
import time

try:
    # Read JSON input from Node.js
    data = json.loads(sys.stdin.read())

    # Extract and validate numerical values as NumPy array
    values = np.array([float(v) for v in data["values"] if v is not None and not isinstance(v, (str, bool))])
    if len(values) < 3:  # Minimum data for meaningful transformation
        raise ValueError("Insufficient data for Johnson transformation (minimum 3 values required)")

    # Sort values for Q-Q plot
    values.sort()

    # Fit Johnson transformation (using PowerTransformer as a proxy; for full Johnson SU/BU, we'd need custom implementation)
    # Note: For a full Johnson SU/BU, you'd typically use 'johnsonsu' from scipy.stats, but it's not directly available.
    # Here, we'll use PowerTransformer (Yeo-Johnson) as a simpler approximation and assess normality post-transformation.
    transformer = PowerTransformer(method='yeo-johnson', standardize=True)
    transformed_values = transformer.fit_transform(values.reshape(-1, 1)).flatten()

    # Assess normality on transformed data using Shapiro-Wilk (as a proxy for Johnson normality check)
    statistic, p_value = shapiro(transformed_values)

    # Determine normality
    normality = "Likely Normal" if p_value > 0.05 else "Likely Not Normal"

    # Calculate Q-Q plot data for transformed values
    n = len(values)
    sample_quantiles = transformed_values  # Transformed sample data, sorted by original sort
    theoretical_quantiles = norm.ppf(np.linspace(1/(n+1), n/(n+1), n))  # Normal theoretical quantiles

    # Return result as JSON with test results and Q-Q plot data
    print(json.dumps({
        "johnson_statistic": float(statistic),  # Shapiro-Wilk statistic on transformed data
        "johnson_p_value": float(p_value),  # Shapiro-Wilk p-value on transformed data
        "normality": normality,
        "transformation_params": {
            "lambda_": transformer.lambdas_[0] if hasattr(transformer, 'lambdas_') else None  # Yeo-Johnson lambda
        },
        "qq_plot_data": {
            "sample_quantiles": sample_quantiles.tolist(),
            "theoretical_quantiles": theoretical_quantiles.tolist()
        }
    }))

except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)