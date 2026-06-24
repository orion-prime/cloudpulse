import shap
import numpy as np
from sklearn.ensemble import IsolationForest

X = np.random.rand(50,4)
model = IsolationForest().fit(X)

explainer = shap.Explainer(model.predict, X[:20])
vals = explainer(X[:5])

print("SHAP works!")