@extends('adminConsole.layout.app')

@section('content')

<h4 class="mb-4"><i class="fa-solid fa-file-shield me-1"></i>Manage Menu Permission</h4>

<!-- Modern Tabs -->
<div class="tab-wrapper mb-4">

    <div class="tab-slider {{ request()->get('tab') == 'view' ? 'right' : 'left' }}"></div>

    <a href="?tab=add" 
       class="tab-item {{ request()->get('tab') != 'view' ? 'active' : '' }}">
        <i class="fa fa-plus-circle me-1"></i> Add Permission
    </a>

    <a href="?tab=view" 
       class="tab-item {{ request()->get('tab') == 'view' ? 'active' : '' }}">
        <i class="fa fa-list me-1"></i> View Permission
    </a>

</div>

<!-- Content -->
<div class="content-card">

     @if(request()->get('tab') == 'view')
        @include('adminConsole.permission.viewPermission')
    @else
        @include('adminConsole.permission.addPermission')
    @endif

</div>

@endsection