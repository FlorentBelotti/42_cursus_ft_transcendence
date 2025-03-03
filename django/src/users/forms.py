from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserChangeForm, PasswordChangeForm
from .models import customUser

User = get_user_model()

class RegisterForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ["username", "email", "password1", "password2"]

class UserUpdateForm(UserChangeForm):
    class Meta:
        model = customUser
        fields = ['username', 'email', 'profile_picture']

class CustomPasswordChangeForm(PasswordChangeForm):
    class Meta:
        model = customUser

class NicknameUpdateForm(forms.ModelForm):
    class Meta:
        model = customUser
        fields = ['nickname']
        widgets = {
            'nickname': forms.TextInput(attrs={'class': 'form-control'}),
        }