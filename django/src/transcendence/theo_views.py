from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

class ProtectedView(APIView):
    permission_classes = [IsAuthenticated]  # cette vue nécessite une authentification JWT

    def get(self, request):
        return Response({"message": "Vous avez accès à cette vue protégée!"})
