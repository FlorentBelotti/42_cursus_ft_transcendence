from typing import Any
from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserChangeForm, PasswordChangeForm
from .models import customUser
import re
from django.contrib.auth.forms import AuthenticationForm
from django.core.exceptions import ValidationError
import os
from django.forms.widgets import FileInput

User = get_user_model()

class CustomLoginForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({'placeholder': 'Username'})
        self.fields['password'].widget.attrs.update({'placeholder': 'Password'})

class RegisterForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = customUser
        fields = ["username", "email", "password1", "password2"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({'placeholder': 'Username'})
        self.fields['email'].widget.attrs.update({'placeholder': 'Email'})
        self.fields['password1'].widget.attrs.update({'placeholder': 'Password'})
        self.fields['password2'].widget.attrs.update({'placeholder': 'Confirm Password'})

    def clean_username(self):
        username = self.cleaned_data.get("username")
        if customUser.objects.filter(username=username).exists():
            raise forms.ValidationError("Username already use.")
        if not 3 <= len(username) <= 30:
            raise forms.ValidationError("Username must be between 3 and 30 characters.")
        if not re.match("^[a-zA-Z0-9]+$", username):
            raise forms.ValidationError("Username can only contain letters and numbers.")
    

        return username

    def clean_email(self):
        email = self.cleaned_data.get("email")
        if customUser.objects.filter(email=email).exists():
            raise forms.ValidationError("Email already use.")
        return email

class UserUpdateForm(UserChangeForm):
    class Meta:
        model = customUser
        fields = ['username', 'email', 'profile_picture']
        exclude = ['password']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].required = False
        self.fields['email'].required = False
        self.fields['profile_picture'].required = False

        self.fields['profile_picture'].widget = FileInput()

        for field in self.fields:
            self.fields[field].help_text = ''
        for field_name, field in self.fields.items():
            if isinstance(field.widget, forms.TextInput):
                field.widget.attrs.update({'class': 'form-control'})
        self.fields.pop('password', None)

    def clean_username(self):
        username = self.cleaned_data.get("username")
        if username and username != self.instance.username:
            if customUser.objects.filter(username=username).exists():
                raise forms.ValidationError("Username already in use.")
        if username and not 3 <= len(username) <= 30:
            raise forms.ValidationError("Username must be between 3 and 30 characters.")
        if not re.match("^[a-zA-Z0-9]+$", username):
            raise forms.ValidationError("Username can only contain letters and numbers.")
        return username

    def clean_email(self):
        email = self.cleaned_data.get("email")
        if not email:
            raise forms.ValidationError("Email cannot be empty.")
        if ' ' in email:
            raise forms.ValidationError("Email cannot contain spaces.")
        if email and email != self.instance.email:
            if customUser.objects.filter(email=email).exists():
                raise forms.ValidationError("Email already in use.")
        return email

    def clean_profile_picture(self):
        image = self.cleaned_data.get('profile_picture')
        if image:
            ext = os.path.splitext(image.name)[1]
            valid_extensions = ['.jpg', '.jpeg', '.png']
            if not ext.lower() in valid_extensions:
                raise ValidationError('Unsupported file extension. Only .jpg and .png are allowed.')
            if image.size > 2 * 1024 * 1024:
                raise ValidationError('Image maximum size is 2MB.')
        return image

class CustomPasswordChangeForm(PasswordChangeForm):
    class Meta:
        model = customUser
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields:
            self.fields[field].help_text = ''

class NicknameUpdateForm(forms.ModelForm):
    class Meta:
        model = customUser
        fields = ['nickname']
        widgets = {
            'nickname': forms.TextInput(attrs={'class': 'form-control'}),
        }
        